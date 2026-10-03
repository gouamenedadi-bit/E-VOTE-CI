import { randomUUID } from "crypto";
import { GENESIS_HASH } from "../core/integrity";
import type {
  AuditRepository,
  BallotRepository,
  Clock,
  ConsumeResult,
  CredentialRepository,
  EligibilityRepository,
  IncidentRepository,
  ParticipationRepository,
  ResultPublicationRepository,
  TallyRepository,
} from "../core/ports";
import type {
  AuditEvent,
  EncryptedBallot,
  IncidentReport,
  ParticipationRecord,
  ResultPublication,
  TallyRecord,
  VoterEligibility,
  VotingCredential,
} from "../core/types";

/**
 * Magasin de demonstration en memoire : permet de faire fonctionner tout
 * le prototype (parcours electeur ET back-office) SANS Supabase configure.
 * A n'utiliser que pour le prototype local — remplace par les adaptateurs
 * Supabase (lib/db/repositories/supabase-repositories.ts) des que
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont definies (lib/runtime.ts).
 *
 * Stocke sur `globalThis` pour survivre au hot-reload de `next dev`.
 */

export type DemoElectionStatus = "draft" | "open" | "closed";

export interface DemoElectionType {
  id: string;
  code: string;
  name: string;
  allowsBlankBallot: boolean;
}

export interface DemoElection {
  id: string;
  electionTypeId: string;
  name: string;
  description: string;
  status: DemoElectionStatus;
  startsAt: Date;
  endsAt: Date;
}

export interface DemoCandidate {
  id: string;
  electionId: string;
  displayName: string;
  partyName: string | null;
  ballotOrder: number;
}

export interface DemoVoter {
  id: string;
  voterNumber: string;
  verificationCode: string;
  fullName: string;
}

export interface DemoPollingStation {
  id: string;
  code: string;
  name: string;
  communeName: string;
  isActive: boolean;
}

interface DemoStoreState {
  electionTypes: Map<string, DemoElectionType>;
  voters: Map<string, DemoVoter>;
  votersByNumber: Map<string, string>;
  elections: Map<string, DemoElection>;
  candidates: Map<string, DemoCandidate[]>;
  pollingStations: Map<string, DemoPollingStation>;
  electionPollingStations: Map<string, Set<string>>;
  eligibility: Map<string, VoterEligibility>;
  credentials: Map<string, VotingCredential>;
  credentialsByVoterElection: Map<string, string>;
  participations: ParticipationRecord[];
  ballots: Map<string, EncryptedBallot[]>;
  tallyRecords: Map<string, TallyRecord[]>;
  incidents: IncidentReport[];
  resultPublications: Map<string, ResultPublication>;
  auditEvents: AuditEvent[];
}

function eligibilityKey(voterId: string, electionId: string): string {
  return `${voterId}:${electionId}`;
}

const ELECTION_TYPE_SEED: Array<[string, string, string]> = [
  ["presidentielle", "Présidentielle", "presidentielle-type"],
  ["legislatives", "Législatives", "legislatives-type"],
  ["municipales", "Municipales", "municipales-type"],
  ["regionales", "Régionales", "regionales-type"],
  ["senatoriales", "Sénatoriales", "senatoriales-type"],
];

function seed(): DemoStoreState {
  const state: DemoStoreState = {
    electionTypes: new Map(),
    voters: new Map(),
    votersByNumber: new Map(),
    elections: new Map(),
    candidates: new Map(),
    pollingStations: new Map(),
    electionPollingStations: new Map(),
    eligibility: new Map(),
    credentials: new Map(),
    credentialsByVoterElection: new Map(),
    participations: [],
    ballots: new Map(),
    tallyRecords: new Map(),
    incidents: [],
    resultPublications: new Map(),
    auditEvents: [],
  };

  for (const [code, name, id] of ELECTION_TYPE_SEED) {
    state.electionTypes.set(id, { id, code, name, allowsBlankBallot: true });
  }

  const electionId = "demo-election-presidentielle";
  state.elections.set(electionId, {
    id: electionId,
    electionTypeId: "presidentielle-type",
    name: "Présidentielle — Simulation",
    description: "Scrutin de démonstration, données entièrement fictives.",
    status: "open",
    startsAt: new Date(Date.now() - 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  state.candidates.set(electionId, [
    { id: "cand-A", electionId, displayName: "Candidat A", partyName: "Parti A", ballotOrder: 1 },
    { id: "cand-B", electionId, displayName: "Candidat B", partyName: "Parti B", ballotOrder: 2 },
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

  const stationSeeds: Array<[string, string, string]> = [
    ["BV-001", "École A", "Abidjan"],
    ["BV-002", "École B", "Abidjan"],
  ];
  for (const [code, name, communeName] of stationSeeds) {
    const id = randomUUID();
    state.pollingStations.set(id, { id, code, name, communeName, isActive: true });
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

// ---------------------------------------------------------------------------
// Lecture generale (voter + public + admin)
// ---------------------------------------------------------------------------

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

export function getElectionType(electionTypeId: string): DemoElectionType | null {
  return getState().electionTypes.get(electionTypeId) ?? null;
}

export function listElectionTypes(): DemoElectionType[] {
  return Array.from(getState().electionTypes.values());
}

export function listOpenElectionsForVoter(
  voterId: string
): Array<DemoElection & { typeLabel: string; allowsBlankBallot: boolean; alreadyVoted: boolean }> {
  const state = getState();
  const result: Array<DemoElection & { typeLabel: string; allowsBlankBallot: boolean; alreadyVoted: boolean }> = [];
  for (const election of state.elections.values()) {
    if (election.status !== "open") continue;
    const key = eligibilityKey(voterId, election.id);
    const eligibility = state.eligibility.get(key);
    if (!eligibility?.isEligible) continue;
    const credentialId = state.credentialsByVoterElection.get(key);
    const credential = credentialId ? state.credentials.get(credentialId) : undefined;
    const type = state.electionTypes.get(election.electionTypeId);
    result.push({
      ...election,
      typeLabel: type?.name ?? "",
      allowsBlankBallot: type?.allowsBlankBallot ?? true,
      alreadyVoted: credential?.status === "consumed",
    });
  }
  return result;
}

export function getElection(
  electionId: string
): (DemoElection & { typeLabel: string; allowsBlankBallot: boolean }) | null {
  const state = getState();
  const election = state.elections.get(electionId);
  if (!election) return null;
  const type = state.electionTypes.get(election.electionTypeId);
  return { ...election, typeLabel: type?.name ?? "", allowsBlankBallot: type?.allowsBlankBallot ?? true };
}

export function listAllElections(): Array<DemoElection & { typeLabel: string }> {
  const state = getState();
  return Array.from(state.elections.values()).map((election) => ({
    ...election,
    typeLabel: state.electionTypes.get(election.electionTypeId)?.name ?? "",
  }));
}

export function listCandidates(electionId: string): DemoCandidate[] {
  return [...(getState().candidates.get(electionId) ?? [])].sort((a, b) => a.ballotOrder - b.ballotOrder);
}

export function hasParticipated(voterId: string, electionId: string): boolean {
  const state = getState();
  const key = eligibilityKey(voterId, electionId);
  const credentialId = state.credentialsByVoterElection.get(key);
  if (!credentialId) return false;
  return state.credentials.get(credentialId)?.status === "consumed";
}

// ---------------------------------------------------------------------------
// Ecriture administrative (back-office, doc 05 §2)
// ---------------------------------------------------------------------------

/**
 * Cree un scrutin en statut `draft`. Pour garder le prototype simple a
 * tester, tous les electeurs de demonstration existants sont
 * automatiquement rendus eligibles au nouveau scrutin (simplification
 * documentee — un usage reel assignerait l'eligibilite via le fichier
 * electoral, doc 01 §4.1).
 */
export function createElection(input: {
  electionTypeId: string;
  name: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
}): DemoElection {
  const state = getState();
  const election: DemoElection = {
    id: randomUUID(),
    electionTypeId: input.electionTypeId,
    name: input.name,
    description: input.description,
    status: "draft",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  };
  state.elections.set(election.id, election);
  state.candidates.set(election.id, []);

  for (const voter of state.voters.values()) {
    state.eligibility.set(eligibilityKey(voter.id, election.id), {
      demoVoterId: voter.id,
      electionId: election.id,
      pollingStationId: null,
      isEligible: true,
    });
  }

  return election;
}

const STATUS_TRANSITIONS: Record<DemoElectionStatus, DemoElectionStatus[]> = {
  draft: ["open"],
  open: ["closed"],
  closed: [],
};

export type UpdateStatusResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_transition" };

export function updateElectionStatus(
  electionId: string,
  newStatus: DemoElectionStatus
): UpdateStatusResult {
  const state = getState();
  const election = state.elections.get(electionId);
  if (!election) return { ok: false, reason: "not_found" };
  if (!STATUS_TRANSITIONS[election.status].includes(newStatus)) {
    return { ok: false, reason: "invalid_transition" };
  }
  election.status = newStatus;
  return { ok: true };
}

export function listPollingStations(): DemoPollingStation[] {
  return Array.from(getState().pollingStations.values());
}

export type CreatePollingStationResult =
  | { ok: true; station: DemoPollingStation }
  | { ok: false; reason: "duplicate_code" };

export function createPollingStation(input: {
  code: string;
  name: string;
  communeName: string;
}): CreatePollingStationResult {
  const state = getState();
  const codeExists = Array.from(state.pollingStations.values()).some((s) => s.code === input.code);
  if (codeExists) return { ok: false, reason: "duplicate_code" };

  const station: DemoPollingStation = {
    id: randomUUID(),
    code: input.code,
    name: input.name,
    communeName: input.communeName,
    isActive: true,
  };
  state.pollingStations.set(station.id, station);
  return { ok: true, station };
}

export function listPollingStationsForElection(electionId: string): DemoPollingStation[] {
  const state = getState();
  const ids = state.electionPollingStations.get(electionId);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => state.pollingStations.get(id))
    .filter((s): s is DemoPollingStation => Boolean(s));
}

export function attachPollingStationToElection(electionId: string, pollingStationId: string): boolean {
  const state = getState();
  if (!state.elections.has(electionId) || !state.pollingStations.has(pollingStationId)) return false;
  const current = state.electionPollingStations.get(electionId) ?? new Set<string>();
  current.add(pollingStationId);
  state.electionPollingStations.set(electionId, current);
  return true;
}

/**
 * Assignation deterministe (stable pour un meme electeur/scrutin) d'un
 * bureau parmi ceux attaches au scrutin — permet de tester des resultats
 * et une reconciliation par bureau (doc 01 §4.4) sans registre electoral
 * reel. Retourne null si aucun bureau n'est attache au scrutin.
 */
export function pickPollingStationForVoter(electionId: string, voterId: string): string | null {
  const stations = listPollingStationsForElection(electionId);
  if (stations.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < voterId.length; i++) {
    hash = (hash * 31 + voterId.charCodeAt(i)) % stations.length;
  }
  return stations[Math.abs(hash) % stations.length]!.id;
}

export function addCandidate(
  electionId: string,
  input: { displayName: string; partyName: string | null }
): DemoCandidate | null {
  const state = getState();
  if (!state.elections.has(electionId)) return null;
  const existing = state.candidates.get(electionId) ?? [];
  const nextOrder = existing.reduce((max, c) => Math.max(max, c.ballotOrder), 0) + 1;
  const candidate: DemoCandidate = {
    id: randomUUID(),
    electionId,
    displayName: input.displayName,
    partyName: input.partyName,
    ballotOrder: nextOrder,
  };
  state.candidates.set(electionId, [...existing, candidate]);
  return candidate;
}

// ---------------------------------------------------------------------------
// Ports de /lib/core
// ---------------------------------------------------------------------------

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
  async countForElection(electionId) {
    return getState().participations.filter((p) => p.electionId === electionId).length;
  },
  async listForElection(electionId) {
    return getState().participations.filter((p) => p.electionId === electionId);
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

export const demoTallyRepository: TallyRepository = {
  async getLastIntegrityHash(electionId) {
    const records = getState().tallyRecords.get(electionId) ?? [];
    const last = records[records.length - 1];
    return last ? last.integrityRecordHash : GENESIS_HASH;
  },

  async listForElection(electionId) {
    return getState().tallyRecords.get(electionId) ?? [];
  },

  async replaceForElection(electionId, records) {
    getState().tallyRecords.set(electionId, records);
  },
};

export const demoIncidentRepository: IncidentRepository = {
  async report(incident) {
    getState().incidents.push(incident);
  },
};

export function listIncidents(): IncidentReport[] {
  return [...getState().incidents];
}

export const demoResultPublicationRepository: ResultPublicationRepository = {
  async getForElection(electionId) {
    return getState().resultPublications.get(electionId) ?? null;
  },

  async upsert(publication) {
    getState().resultPublications.set(publication.electionId, publication);
  },

  async listPublished() {
    return Array.from(getState().resultPublications.values()).filter((p) => p.status === "published");
  },
};
