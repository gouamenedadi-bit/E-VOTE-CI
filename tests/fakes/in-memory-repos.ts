import { GENESIS_HASH } from "../../lib/core/integrity";
import type {
  AuditRepository,
  BallotRepository,
  Clock,
  ConsumeResult,
  CredentialRepository,
  EligibilityRepository,
  IncidentRepository,
  MasterKeyProvider,
  ParticipationRepository,
  ResultPublicationRepository,
  TallyRepository,
  TokenGenerator,
} from "../../lib/core/ports";
import type {
  AuditEvent,
  EncryptedBallot,
  IncidentReport,
  ParticipationRecord,
  ResultPublication,
  TallyRecord,
  VoterEligibility,
  VotingCredential,
} from "../../lib/core/types";

export class FixedClock implements Clock {
  constructor(private current: Date = new Date("2026-10-03T12:00:00Z")) {}
  now(): Date {
    return this.current;
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialTokenGenerator implements TokenGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `test-token-${this.counter}`;
  }
}

export class InMemoryEligibilityRepository implements EligibilityRepository {
  private entries = new Map<string, VoterEligibility>();

  seed(entry: VoterEligibility): void {
    this.entries.set(`${entry.demoVoterId}:${entry.electionId}`, entry);
  }

  async findEligibility(
    demoVoterId: string,
    electionId: string
  ): Promise<VoterEligibility | null> {
    return this.entries.get(`${demoVoterId}:${electionId}`) ?? null;
  }
}

export class InMemoryCredentialRepository implements CredentialRepository {
  private byVoterElection = new Map<string, VotingCredential>();
  private byTokenHash = new Map<string, VotingCredential>();

  async findActiveCredential(
    demoVoterId: string,
    electionId: string
  ): Promise<VotingCredential | null> {
    const credential = this.byVoterElection.get(`${demoVoterId}:${electionId}`);
    if (!credential) return null;
    if (credential.status === "issued" || credential.status === "consumed") {
      return credential;
    }
    return null;
  }

  async issue(credential: VotingCredential): Promise<void> {
    const key = `${credential.demoVoterId}:${credential.electionId}`;
    const existing = this.byVoterElection.get(key);
    if (existing && (existing.status === "issued" || existing.status === "consumed")) {
      throw new Error("unique_violation: an active credential already exists for this voter/election");
    }
    this.byVoterElection.set(key, credential);
    this.byTokenHash.set(credential.tokenHash, credential);
  }

  // Synchrone en interne (pas d'await entre lecture et ecriture) afin de
  // modeliser le verrou transactionnel qu'un adaptateur reel obtiendrait
  // avec SELECT ... FOR UPDATE : aucune interleaving possible ici.
  async tryConsume(tokenHash: string, now: Date): Promise<ConsumeResult> {
    const credential = this.byTokenHash.get(tokenHash);
    if (!credential) {
      return { ok: false, reason: "not_found" };
    }
    if (credential.status === "revoked") {
      return { ok: false, reason: "revoked" };
    }
    if (credential.status === "consumed") {
      return { ok: false, reason: "already_consumed" };
    }
    if (credential.expiresAt.getTime() < now.getTime()) {
      credential.status = "expired";
      return { ok: false, reason: "expired" };
    }

    const consumed: VotingCredential = { ...credential, status: "consumed", consumedAt: now };
    this.byTokenHash.set(tokenHash, consumed);
    this.byVoterElection.set(`${consumed.demoVoterId}:${consumed.electionId}`, consumed);
    return { ok: true, credential: consumed };
  }
}

export class InMemoryParticipationRepository implements ParticipationRepository {
  records: ParticipationRecord[] = [];
  async record(participation: ParticipationRecord): Promise<void> {
    this.records.push(participation);
  }
  async countForElection(electionId: string): Promise<number> {
    return this.records.filter((r) => r.electionId === electionId).length;
  }
  async listForElection(electionId: string): Promise<ParticipationRecord[]> {
    return this.records.filter((r) => r.electionId === electionId);
  }
}

export class InMemoryBallotRepository implements BallotRepository {
  private ballots: EncryptedBallot[] = [];

  async getLastIntegrityHash(electionId: string): Promise<string> {
    const forElection = this.ballots.filter((b) => b.electionId === electionId);
    const last = forElection[forElection.length - 1];
    return last ? last.integrityRecordHash : GENESIS_HASH;
  }

  async insert(ballot: EncryptedBallot): Promise<void> {
    this.ballots.push(ballot);
  }

  async listForElection(electionId: string): Promise<EncryptedBallot[]> {
    return this.ballots.filter((b) => b.electionId === electionId);
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  private events: AuditEvent[] = [];

  async getLastHash(): Promise<string> {
    const last = this.events[this.events.length - 1];
    return last ? last.recordHash : GENESIS_HASH;
  }

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async listAll(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

export class InMemoryTallyRepository implements TallyRepository {
  private records: TallyRecord[] = [];

  async getLastIntegrityHash(electionId: string): Promise<string> {
    const forElection = this.records.filter((r) => r.electionId === electionId);
    const last = forElection[forElection.length - 1];
    return last ? last.integrityRecordHash : GENESIS_HASH;
  }

  async listForElection(electionId: string): Promise<TallyRecord[]> {
    return this.records.filter((r) => r.electionId === electionId);
  }

  async replaceForElection(electionId: string, records: TallyRecord[]): Promise<void> {
    this.records = this.records.filter((r) => r.electionId !== electionId).concat(records);
  }
}

export class InMemoryIncidentRepository implements IncidentRepository {
  incidents: IncidentReport[] = [];
  async report(incident: IncidentReport): Promise<void> {
    this.incidents.push(incident);
  }
}

export class InMemoryResultPublicationRepository implements ResultPublicationRepository {
  private byElection = new Map<string, ResultPublication>();

  async getForElection(electionId: string): Promise<ResultPublication | null> {
    return this.byElection.get(electionId) ?? null;
  }

  async upsert(publication: ResultPublication): Promise<void> {
    this.byElection.set(publication.electionId, publication);
  }

  async listPublished(): Promise<ResultPublication[]> {
    return Array.from(this.byElection.values()).filter((p) => p.status === "published");
  }
}

export class FixedMasterKeyProvider implements MasterKeyProvider {
  private keys = new Map<string, Buffer>([["test-key-1", Buffer.alloc(32, 7)]]);
  getKey(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`unknown key id: ${keyId}`);
    return key;
  }
  currentKeyId(): string {
    return "test-key-1";
  }
}
