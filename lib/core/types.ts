export type CredentialStatus = "issued" | "consumed" | "expired" | "revoked";

export interface VotingCredential {
  id: string;
  tokenHash: string;
  demoVoterId: string;
  electionId: string;
  status: CredentialStatus;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface VoterEligibility {
  demoVoterId: string;
  electionId: string;
  pollingStationId: string | null;
  isEligible: boolean;
}

export interface ParticipationRecord {
  id: string;
  electionId: string;
  pollingStationId: string | null;
  credentialId: string;
  recordedAt: Date;
}

export type BallotType = "valid" | "blank" | "null";

export interface EncryptedBallot {
  id: string;
  electionId: string;
  pollingStationId: string | null;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  wrappedDataKey: Buffer;
  encryptionKeyId: string;
  integrityPrevHash: string;
  integrityRecordHash: string;
  recordedAt: Date;
}

export interface BallotChoice {
  type: BallotType;
  candidateId: string | null;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actionCode: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  prevHash: string;
  recordHash: string;
  occurredAt: Date;
}

export interface TallyRecord {
  id: string;
  electionId: string;
  pollingStationId: string | null;
  candidateId: string | null;
  ballotType: BallotType;
  voteCount: number;
  integrityPrevHash: string;
  integrityRecordHash: string;
  computedAt: Date;
}

export type PublicationStatus = "draft" | "verified" | "published";

export interface ResultPublication {
  id: string;
  electionId: string;
  scopeLevel: "national";
  status: PublicationStatus;
  publishedAt: Date | null;
}

export interface IncidentReport {
  id: string;
  electionId: string | null;
  category: string;
  description: string;
  status: "open" | "investigating" | "resolved";
  openedAt: Date;
  resolvedAt: Date | null;
}
