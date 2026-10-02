import { randomUUID } from "crypto";
import { GENESIS_HASH } from "../core/integrity";
import type {
  AuditRepository,
  BallotRepository,
  Clock,
  ConsumeResult,
  CredentialRepository,
  EligibilityRepository,
  ParticipationRepository,
} from "../core/ports";
import type {
  AuditEvent,
  EncryptedBallot,
  ParticipationRecord,
  VoterEligibility,
  VotingCredential,
} from "../core/types";

/**
 * Magasin de demonstration en memoire : permet de faire fonctionner le
 * parcours electeur complet SANS Supabase configure. A n'utiliser que pour
 * le prototype local — remplace par les adaptateurs Supabase
 * (lib/db/repositories/supabase-repositories.ts) des que SUPABASE_URL et
 * SUPABASE_SERVICE_ROLE_KEY sont definies (voir lib/runtime.ts).
 *
 * Stocke sur `globalThis` pour survivre au hot-reload de `next dev`
 * (sinon chaque recompilation reinitialiserait les Maps).
 */

export interface DemoCandidate {
  id: string;
  electionId: string;
  displayName: string;
  partyName: string | null;
  ballotOrder: number;
  isBlankOption?: boolean;
}

export interface DemoElection {
  id: string;
  name: string;
  typeLabel: string;
  status: "open" | "closed";
  startsAt: Date;
  endsAt: Date;
  allowsBlankBallot: boolean;
}

export interface DemoVoter {
  id: string;
  voterNumber: string;
  verificationCode: string;
  fullName: string;
}

interface DemoStoreState {
  voters: Map<string, DemoVoter>;
  votersByNumber: Map<string, string>;
  elections: Map<string, DemoElection>;
  candidates: Map<string, DemoCandidate[]>;
  eligibility: Map<string, VoterEligibility>;
  credentials: Map<string, VotingCredential>;
  credentialsByVoterElection: Map<string, string>;
  participations: ParticipationRecord[];
  ballots: Map<string, EncryptedBallot[]>;
  auditEvents: AuditEvent[];
}

function eligibilityKey(voterId: string, electionId: string): string {
  return `${voterId}:${electionId}`;
}

function seed(): DemoStoreState {
  const state: DemoStoreState = {
    voters: new Map(),
    votersByNumber: new Map(),
    elections: new Map(),
    candidates: new Map(),
    eligibility: new Map(),
    credentials: new Map(),
    credentialsByVoterElection: new Map(),
    participations: [],
    ballots: new Map(),
    auditEvents: [],
  };

  const electionId = "demo-election-presidentielle";
  state.elections.set(electionId, {
    id: electionId,
    name: "Présidentielle — Simulation",
    typeLabel: "Présidentielle",
    status: "open",
    startsAt: new Date(Date.now() - 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    allowsBlankBallot: true,
  });

  state.candidates.set(electionId, [
    { id: "cand-A", electionId, displayName: "Candidat A", partyName: "Parti A", ballotOrder: 1 },
    { id: "cand-B", electionId, displayName: "Candidat B", partyName: "Parti B", ballotOrder: 2 },
    { id: "cand-blanc", electionId, displayName: "Vote blanc", partyName: null, ballotOrder: 3, isBlankOption: true },
  ]);

  const demoVoters: Array<[string, string, string]> = [
    ["0000001", "123456", "Électeur Démo 1"],
    ["0000002", "123456", "Électeur Démo 2"],
    ["0000003", "123456", "Électeur Démo 3"],
  ];

  for (const [voterNumber, verificationCode, fullName] of demoVoters) {
    const id = randomUUID();
    state.voters.set(id, { id, voterNumber, verificationCode, fullName });
    state.votersByNumber.set(voterNumber, id);
    state.eligibility.set(eligibilityKey(id, electionId), {
      demoVoterId: id,
      electionId,
      pollingStationId: null,
      isEligible: true,
    });
  }

  return state;
}

function getState(): DemoStoreState {
  const globalKey = "__eVoteCiDemoStore__";
  const g = globalThis as unknown as Record<string, DemoStoreState | undefined>;
  if (!g[globalKey]) {
    g[globalKey] = seed();
  }
  return g[globalKey]!;
}

export function findVoterByCredentials(
  voterNumber: string,
  verificationCode: string
): DemoVoter | null {
  const state = getState();
  const id = state.votersByNumber.get(voterNumber);
  if (!id) return null;
  const voter = state.voters.get(id);
  if (!voter || voter.verificationCode !== verificationCode) return null;
  return voter;
}

export function getVoter(voterId: string): DemoVoter | null {
  return getState().voters.get(voterId) ?? null;
}

export function listOpenElectionsForVoter(
  voterId: string
): Array<DemoElection & { alreadyVoted: boolean }> {
  const state = getState();
  const result: Array<DemoElection & { alreadyVoted: boolean }> = [];
  for (const election of state.elections.values()) {
    const key = eligibilityKey(voterId, election.id);
    const eligibility = state.eligibility.get(key);
    if (!eligibility?.isEligible) continue;
    const credentialId = state.credentialsByVoterElection.get(key);
    const credential = credentialId ? state.credentials.get(credentialId) : undefined;
    result.push({ ...election, alreadyVoted: credential?.status === "consumed" });
  }
  return result;
}

export function getElection(electionId: string): DemoElection | null {
  return getState().elections.get(electionId) ?? null;
}

export function listCandidates(electionId: string): DemoCandidate[] {
  return getState().candidates.get(electionId) ?? [];
}

export const demoClock: Clock = { now: () => new Date() };

export const demoEligibilityRepository: EligibilityRepository = {
  async findEligibility(demoVoterId, electionId) {
    return getState().eligibility.get(eligibilityKey(demoVoterId, electionId)) ?? null;
  },
};

export const demoCredentialRepository: CredentialRepository = {
  async findActiveCredential(demoVoterId, electionId) {
    const state = getState();
    const id = state.credentialsByVoterElection.get(eligibilityKey(demoVoterId, electionId));
    if (!id) return null;
    const credential = state.credentials.get(id) ?? null;
    if (credential && (credential.status === "issued" || credential.status === "consumed")) {
      return credential;
    }
    return null;
  },

  async issue(credential) {
    const state = getState();
    const key = eligibilityKey(credential.demoVoterId, credential.electionId);
    const existingId = state.credentialsByVoterElection.get(key);
    const existing = existingId ? state.credentials.get(existingId) : undefined;
    if (existing && (existing.status === "issued" || existing.status === "consumed")) {
      throw new Error("unique_violation: an active credential already exists for this voter/election");
    }
    state.credentials.set(credential.id, credential);
    state.credentialsByVoterElection.set(key, credential.id);
  },

  async tryConsume(tokenHash, now): Promise<ConsumeResult> {
    const state = getState();
    let found: VotingCredential | undefined;
    for (const credential of state.credentials.values()) {
      if (credential.tokenHash === tokenHash) {
        found = credential;
        break;
      }
    }
    if (!found) return { ok: false, reason: "not_found" };
    if (found.status === "revoked") return { ok: false, reason: "revoked" };
    if (found.status === "consumed") return { ok: false, reason: "already_consumed" };
    if (found.expiresAt.getTime() < now.getTime()) {
      found.status = "expired";
      return { ok: false, reason: "expired" };
    }
    found.status = "consumed";
    found.consumedAt = now;
    return { ok: true, credential: found };
  },
};

export const demoParticipationRepository: ParticipationRepository = {
  async record(participation) {
    getState().participations.push(participation);
  },
};

export const demoBallotRepository: BallotRepository = {
  async getLastIntegrityHash(electionId) {
    const ballots = getState().ballots.get(electionId) ?? [];
    const last = ballots[ballots.length - 1];
    return last ? last.integrityRecordHash : GENESIS_HASH;
  },

  async insert(ballot) {
    const state = getState();
    const list = state.ballots.get(ballot.electionId) ?? [];
    list.push(ballot);
    state.ballots.set(ballot.electionId, list);
  },

  async listForElection(electionId) {
    return getState().ballots.get(electionId) ?? [];
  },
};

export const demoAuditRepository: AuditRepository = {
  async getLastHash() {
    const events = getState().auditEvents;
    const last = events[events.length - 1];
    return last ? last.recordHash : GENESIS_HASH;
  },

  async append(event) {
    getState().auditEvents.push(event);
  },

  async listAll() {
    return [...getState().auditEvents];
  },
};

export function hasParticipated(voterId: string, electionId: string): boolean {
  const state = getState();
  const key = eligibilityKey(voterId, electionId);
  const credentialId = state.credentialsByVoterElection.get(key);
  if (!credentialId) return false;
  return state.credentials.get(credentialId)?.status === "consumed";
}
