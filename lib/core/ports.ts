import type {
  AuditEvent,
  EncryptedBallot,
  ParticipationRecord,
  VoterEligibility,
  VotingCredential,
} from "./types";

/**
 * Ports (interfaces) implementes par les adaptateurs Supabase en production
 * et par des doubles en memoire dans les tests. La logique de /lib/core ne
 * depend jamais directement de Supabase ni de Next.js.
 */

export interface Clock {
  now(): Date;
}

export interface TokenGenerator {
  /** Jeton aleatoire opaque transmis au navigateur (jamais stocke en clair). */
  generate(): string;
}

export interface EligibilityRepository {
  findEligibility(
    demoVoterId: string,
    electionId: string
  ): Promise<VoterEligibility | null>;
}

export type ConsumeResult =
  | { ok: true; credential: VotingCredential }
  | { ok: false; reason: "not_found" | "expired" | "already_consumed" | "revoked" };

export interface CredentialRepository {
  findActiveCredential(
    demoVoterId: string,
    electionId: string
  ): Promise<VotingCredential | null>;

  /** Doit echouer si une ligne (demoVoterId, electionId) existe deja — contrainte d'unicite. */
  issue(credential: VotingCredential): Promise<void>;

  /**
   * Transition atomique issued -> consumed. Doit etre implementee avec un
   * verrou (ex. SELECT ... FOR UPDATE) cote adaptateur reel pour garantir
   * qu'un meme jeton ne peut jamais etre consomme deux fois, meme sous
   * requetes concurrentes.
   */
  tryConsume(tokenHash: string, now: Date): Promise<ConsumeResult>;
}

export interface ParticipationRepository {
  record(participation: ParticipationRecord): Promise<void>;
}

export interface BallotRepository {
  getLastIntegrityHash(electionId: string): Promise<string>;
  insert(ballot: EncryptedBallot): Promise<void>;
  listForElection(electionId: string): Promise<EncryptedBallot[]>;
}

export interface AuditRepository {
  getLastHash(): Promise<string>;
  append(event: AuditEvent): Promise<void>;
  listAll(): Promise<AuditEvent[]>;
}

export interface MasterKeyProvider {
  /** Cle maitresse cote serveur uniquement, jamais exposee au navigateur. */
  getKey(keyId: string): Buffer;
  currentKeyId(): string;
}
