import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GENESIS_HASH } from "../../core/integrity";
import type {
  AuditRepository,
  BallotRepository,
  ConsumeResult,
  CredentialRepository,
  EligibilityRepository,
  ParticipationRepository,
} from "../../core/ports";
import type {
  AuditEvent,
  EncryptedBallot,
  ParticipationRecord,
  VoterEligibility,
  VotingCredential,
} from "../../core/types";

/**
 * Adaptateurs Supabase pour les ports de /lib/core (doc 02 §2). Chaque
 * methode traduit les colonnes snake_case de la base vers les types
 * camelCase du domaine, et inversement.
 */

export class SupabaseEligibilityRepository implements EligibilityRepository {
  constructor(private client: SupabaseClient) {}

  async findEligibility(
    demoVoterId: string,
    electionId: string
  ): Promise<VoterEligibility | null> {
    const { data, error } = await this.client
      .from("voter_eligibility")
      .select("demo_voter_id, election_id, polling_station_id, is_eligible")
      .eq("demo_voter_id", demoVoterId)
      .eq("election_id", electionId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      demoVoterId: data.demo_voter_id,
      electionId: data.election_id,
      pollingStationId: data.polling_station_id,
      isEligible: data.is_eligible,
    };
  }
}

function mapCredentialRow(row: Record<string, unknown>): VotingCredential {
  return {
    id: row.id as string,
    tokenHash: row.token_hash as string,
    demoVoterId: row.demo_voter_id as string,
    electionId: row.election_id as string,
    status: row.status as VotingCredential["status"],
    issuedAt: new Date(row.issued_at as string),
    expiresAt: new Date(row.expires_at as string),
    consumedAt: row.consumed_at ? new Date(row.consumed_at as string) : null,
  };
}

export class SupabaseCredentialRepository implements CredentialRepository {
  constructor(private client: SupabaseClient) {}

  async findActiveCredential(
    demoVoterId: string,
    electionId: string
  ): Promise<VotingCredential | null> {
    const { data, error } = await this.client
      .from("voting_credentials")
      .select("*")
      .eq("demo_voter_id", demoVoterId)
      .eq("election_id", electionId)
      .in("status", ["issued", "consumed"])
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapCredentialRow(data);
  }

  async issue(credential: VotingCredential): Promise<void> {
    const { error } = await this.client.from("voting_credentials").insert({
      id: credential.id,
      token_hash: credential.tokenHash,
      demo_voter_id: credential.demoVoterId,
      election_id: credential.electionId,
      status: credential.status,
      issued_at: credential.issuedAt.toISOString(),
      expires_at: credential.expiresAt.toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("unique_violation: credential already issued for this voter/election");
      }
      throw error;
    }
  }

  /**
   * Delegue la transition atomique a la fonction SQL consume_voting_credential
   * (verrou `for update`, doc 03 §8) — jamais un simple SELECT puis UPDATE
   * depuis le client, qui serait vulnerable a une course concurrente.
   */
  async tryConsume(tokenHash: string, _now: Date): Promise<ConsumeResult> {
    const { data, error } = await this.client
      .rpc("consume_voting_credential", { p_token_hash: tokenHash })
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, reason: "not_found" };

    const row = data as Record<string, unknown>;
    const outcome = row.outcome as "ok" | "not_found" | "expired" | "already_consumed" | "revoked";

    if (outcome !== "ok") {
      return { ok: false, reason: outcome };
    }

    return { ok: true, credential: mapCredentialRow(row) };
  }
}

export class SupabaseParticipationRepository implements ParticipationRepository {
  constructor(private client: SupabaseClient) {}

  async record(participation: ParticipationRecord): Promise<void> {
    const { error } = await this.client.from("participation_records").insert({
      id: participation.id,
      election_id: participation.electionId,
      polling_station_id: participation.pollingStationId,
      credential_id: participation.credentialId,
      recorded_at: participation.recordedAt.toISOString(),
    });
    if (error) throw error;
  }
}

export class SupabaseBallotRepository implements BallotRepository {
  constructor(private client: SupabaseClient) {}

  async getLastIntegrityHash(electionId: string): Promise<string> {
    const { data, error } = await this.client
      .from("encrypted_ballots")
      .select("integrity_record_hash")
      .eq("election_id", electionId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.integrity_record_hash ?? GENESIS_HASH;
  }

  async insert(ballot: EncryptedBallot): Promise<void> {
    const { error } = await this.client.from("encrypted_ballots").insert({
      id: ballot.id,
      election_id: ballot.electionId,
      ciphertext: ballot.ciphertext,
      iv: ballot.iv,
      auth_tag: ballot.authTag,
      wrapped_data_key: ballot.wrappedDataKey,
      encryption_key_id: "env-key-1",
      integrity_prev_hash: ballot.integrityPrevHash,
      integrity_record_hash: ballot.integrityRecordHash,
      recorded_at: ballot.recordedAt.toISOString(),
    });
    if (error) throw error;
  }

  async listForElection(electionId: string): Promise<EncryptedBallot[]> {
    const { data, error } = await this.client
      .from("encrypted_ballots")
      .select("*")
      .eq("election_id", electionId)
      .order("recorded_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      electionId: row.election_id,
      ciphertext: Buffer.from(row.ciphertext),
      iv: Buffer.from(row.iv),
      authTag: Buffer.from(row.auth_tag),
      wrappedDataKey: Buffer.from(row.wrapped_data_key),
      integrityPrevHash: row.integrity_prev_hash,
      integrityRecordHash: row.integrity_record_hash,
      recordedAt: new Date(row.recorded_at),
    }));
  }
}

export class SupabaseAuditRepository implements AuditRepository {
  constructor(private client: SupabaseClient) {}

  async getLastHash(): Promise<string> {
    const { data, error } = await this.client
      .from("audit_events")
      .select("record_hash")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.record_hash ?? GENESIS_HASH;
  }

  async append(event: AuditEvent): Promise<void> {
    const { error } = await this.client.from("audit_events").insert({
      id: event.id,
      actor_user_id: event.actorUserId,
      action_code: event.actionCode,
      target_type: event.targetType,
      target_id: event.targetId,
      metadata: event.metadata,
      prev_hash: event.prevHash,
      record_hash: event.recordHash,
      occurred_at: event.occurredAt.toISOString(),
    });
    if (error) throw error;
  }

  async listAll(): Promise<AuditEvent[]> {
    const { data, error } = await this.client
      .from("audit_events")
      .select("*")
      .order("occurred_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actionCode: row.action_code,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: row.metadata,
      prevHash: row.prev_hash,
      recordHash: row.record_hash,
      occurredAt: new Date(row.occurred_at),
    }));
  }
}
