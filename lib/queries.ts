import "server-only";
import { isSupabaseConfigured, getServiceRoleClient } from "./db/supabase-server";
import { verifyAuditTrail } from "./core/audit";
import { reconcile } from "./core/tally";
import * as demo from "./demo/store";

/**
 * Requetes de lecture (voter, public, back-office) — pas des ports de
 * /lib/core : ce sont des lectures publiques/semi-publiques, pas des
 * operations critiques sur le secret du vote. Memes deux branches
 * demo/Supabase que lib/runtime.ts.
 */

export type ElectionStatus = "draft" | "open" | "closed";

export interface VoterSummary {
  id: string;
  voterNumber: string;
  fullName: string | null;
}

export interface ElectionSummary {
  id: string;
  name: string;
  description: string;
  typeLabel: string;
  status: ElectionStatus;
  startsAt: Date;
  endsAt: Date;
  allowsBlankBallot: boolean;
  alreadyVoted: boolean;
}

export interface CandidateSummary {
  id: string;
  displayName: string;
  partyName: string | null;
  ballotOrder: number;
  isBlankOption?: boolean;
}

export interface ElectionTypeSummary {
  id: string;
  code: string;
  name: string;
}

export interface PollingStationSummary {
  id: string;
  code: string;
  name: string;
  communeName: string;
  isActive: boolean;
}

export async function listPollingStations(): Promise<PollingStationSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listPollingStations().map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      communeName: s.communeName,
      isActive: s.isActive,
    }));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("polling_stations")
    .select("id, code, name, commune_name, is_active")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    communeName: row.commune_name ?? "",
    isActive: row.is_active,
  }));
}

export async function listPollingStationsForElection(electionId: string): Promise<PollingStationSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listPollingStationsForElection(electionId).map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      communeName: s.communeName,
      isActive: s.isActive,
    }));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("election_polling_stations")
    .select("polling_stations(id, code, name, commune_name, is_active)")
    .eq("election_id", electionId);
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const station = row.polling_stations as unknown as
        | { id: string; code: string; name: string; commune_name: string | null; is_active: boolean }
        | { id: string; code: string; name: string; commune_name: string | null; is_active: boolean }[]
        | null;
      return Array.isArray(station) ? station[0] : station;
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ id: s.id, code: s.code, name: s.name, communeName: s.commune_name ?? "", isActive: s.is_active }));
}

export async function listElectionsForStation(pollingStationId: string): Promise<ElectionSummary[]> {
  if (!isSupabaseConfigured()) {
    const ids = demo.listElectionIdsForStation(pollingStationId);
    const all = await listAllElections();
    return all.filter((e) => ids.includes(e.id));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("election_polling_stations")
    .select("election_id")
    .eq("polling_station_id", pollingStationId);
  if (error) throw error;

  const ids = (data ?? []).map((r) => r.election_id);
  if (ids.length === 0) return [];
  const all = await listAllElections();
  return all.filter((e) => ids.includes(e.id));
}

export async function getPollingStation(pollingStationId: string): Promise<PollingStationSummary | null> {
  const all = await listPollingStations();
  return all.find((s) => s.id === pollingStationId) ?? null;
}

export async function countParticipationsAtStation(
  electionId: string,
  pollingStationId: string
): Promise<number> {
  if (!isSupabaseConfigured()) {
    const records = await demo.demoParticipationRepository.listForElection(electionId);
    return records.filter((r) => r.pollingStationId === pollingStationId).length;
  }

  const client = getServiceRoleClient();
  const { count, error } = await client
    .from("participation_records")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId)
    .eq("polling_station_id", pollingStationId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Assignation deterministe et stable d'un bureau de vote parmi ceux
 * rattaches au scrutin (doc 01 §4.4) — simplification de prototype en
 * l'absence de fichier electoral reel (doc 01 §4.1). Retourne null si
 * aucun bureau n'est rattache.
 */
export async function pickPollingStationForVoter(
  electionId: string,
  voterId: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return demo.pickPollingStationForVoter(electionId, voterId);
  }

  const stations = await listPollingStationsForElection(electionId);
  if (stations.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < voterId.length; i++) {
    hash = (hash * 31 + voterId.charCodeAt(i)) % stations.length;
  }
  return stations[Math.abs(hash) % stations.length]!.id;
}

export interface IncidentSummary {
  id: string;
  electionId: string | null;
  category: string;
  description: string;
  status: "open" | "investigating" | "resolved";
  openedAt: Date;
}

export async function lookupVoterByCredentials(
  voterNumber: string,
  verificationCode: string
): Promise<VoterSummary | null> {
  if (!isSupabaseConfigured()) {
    const voter = demo.findVoterByCredentials(voterNumber, verificationCode);
    return voter ? { id: voter.id, voterNumber: voter.voterNumber, fullName: voter.fullName } : null;
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("demo_voters")
    .select("id, demo_voter_number, verification_code, full_name")
    .eq("demo_voter_number", voterNumber)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.verification_code !== verificationCode) return null;

  return { id: data.id, voterNumber: data.demo_voter_number, fullName: data.full_name };
}

export async function getVoter(voterId: string): Promise<VoterSummary | null> {
  if (!isSupabaseConfigured()) {
    const voter = demo.getVoter(voterId);
    return voter ? { id: voter.id, voterNumber: voter.voterNumber, fullName: voter.fullName } : null;
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("demo_voters")
    .select("id, demo_voter_number, full_name")
    .eq("id", voterId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { id: data.id, voterNumber: data.demo_voter_number, fullName: data.full_name };
}

function mapSupabaseElectionRow(row: Record<string, unknown>): ElectionSummary {
  const electionType = row.election_types as unknown as
    | { name: string; allows_blank_ballot: boolean }
    | { name: string; allows_blank_ballot: boolean }[]
    | null;
  const typeInfo = Array.isArray(electionType) ? electionType[0] : electionType;

  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    typeLabel: typeInfo?.name ?? "",
    status: row.status as ElectionStatus,
    startsAt: new Date(row.starts_at as string),
    endsAt: new Date(row.ends_at as string),
    allowsBlankBallot: typeInfo?.allows_blank_ballot ?? true,
    alreadyVoted: false,
  };
}

export async function listElectionsForVoter(voterId: string): Promise<ElectionSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listOpenElectionsForVoter(voterId).map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      typeLabel: e.typeLabel,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allowsBlankBallot: e.allowsBlankBallot,
      alreadyVoted: e.alreadyVoted,
    }));
  }

  const client = getServiceRoleClient();
  const { data: eligibilityRows, error: eligibilityError } = await client
    .from("voter_eligibility")
    .select("election_id")
    .eq("demo_voter_id", voterId)
    .eq("is_eligible", true);

  if (eligibilityError) throw eligibilityError;
  const electionIds = (eligibilityRows ?? []).map((r) => r.election_id);
  if (electionIds.length === 0) return [];

  const { data: elections, error: electionsError } = await client
    .from("elections")
    .select("id, name, description, starts_at, ends_at, status, election_types(name, allows_blank_ballot)")
    .in("id", electionIds)
    .eq("status", "open");

  if (electionsError) throw electionsError;

  const { data: credentials, error: credentialsError } = await client
    .from("voting_credentials")
    .select("election_id, status")
    .eq("demo_voter_id", voterId)
    .in("election_id", electionIds);

  if (credentialsError) throw credentialsError;
  const votedElectionIds = new Set(
    (credentials ?? []).filter((c) => c.status === "consumed").map((c) => c.election_id)
  );

  return (elections ?? []).map((row) => ({
    ...mapSupabaseElectionRow(row),
    alreadyVoted: votedElectionIds.has(row.id as string),
  }));
}

export async function getElection(electionId: string): Promise<ElectionSummary | null> {
  if (!isSupabaseConfigured()) {
    const election = demo.getElection(electionId);
    if (!election) return null;
    return {
      id: election.id,
      name: election.name,
      description: election.description,
      typeLabel: election.typeLabel,
      status: election.status,
      startsAt: election.startsAt,
      endsAt: election.endsAt,
      allowsBlankBallot: election.allowsBlankBallot,
      alreadyVoted: false,
    };
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("elections")
    .select("id, name, description, starts_at, ends_at, status, election_types(name, allows_blank_ballot)")
    .eq("id", electionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSupabaseElectionRow(data);
}

/** Vue administrateur : tous les scrutins, quel que soit leur statut. */
export async function listAllElections(): Promise<ElectionSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listAllElections().map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      typeLabel: e.typeLabel,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allowsBlankBallot: true,
      alreadyVoted: false,
    }));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("elections")
    .select("id, name, description, starts_at, ends_at, status, election_types(name, allows_blank_ballot)")
    .order("starts_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapSupabaseElectionRow);
}

export async function listElectionTypes(): Promise<ElectionTypeSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listElectionTypes().map((t) => ({ id: t.id, code: t.code, name: t.name }));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client.from("election_types").select("id, code, name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name }));
}

/** Candidats reels uniquement (sans l'option "vote blanc"), pour le back-office. */
export async function listCandidates(electionId: string): Promise<CandidateSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listCandidates(electionId).map((c) => ({
      id: c.id,
      displayName: c.displayName,
      partyName: c.partyName,
      ballotOrder: c.ballotOrder,
    }));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("candidates")
    .select("id, display_name, party_name, ballot_order")
    .eq("election_id", electionId)
    .eq("validation_status", "validated")
    .order("ballot_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    partyName: row.party_name,
    ballotOrder: row.ballot_order,
  }));
}

/**
 * Options de vote presentees a l'electeur : candidats reels + l'option
 * "vote blanc" ajoutee ici, a l'affichage — jamais stockee comme une
 * ligne `candidates` (doc 03 §5 : le vote blanc est un `ballot_type`,
 * pas un candidat).
 */
export async function listVotableOptions(electionId: string): Promise<CandidateSummary[]> {
  const [candidates, election] = await Promise.all([listCandidates(electionId), getElection(electionId)]);

  if (!election?.allowsBlankBallot) return candidates;

  const nextOrder = candidates.reduce((max, c) => Math.max(max, c.ballotOrder), 0) + 1;
  return [
    ...candidates,
    { id: "__blank__", displayName: "Vote blanc", partyName: null, ballotOrder: nextOrder, isBlankOption: true },
  ];
}

export interface TallyResultRow {
  candidateId: string | null;
  candidateName: string;
  ballotType: "valid" | "blank" | "null";
  voteCount: number;
}

export interface PublicationInfo {
  status: "draft" | "verified" | "published";
  publishedAt: Date | null;
}

export interface StationReconciliation {
  pollingStationId: string | null;
  pollingStationLabel: string;
  participationCount: number;
  ballotCount: number;
  consistent: boolean;
}

export interface TallySummary {
  hasTally: boolean;
  records: TallyResultRow[];
  participationCount: number;
  ballotCount: number;
  consistent: boolean;
  stations: StationReconciliation[];
  publication: PublicationInfo | null;
}

function countByStation<T extends { pollingStationId: string | null }>(items: T[]): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const item of items) {
    counts.set(item.pollingStationId, (counts.get(item.pollingStationId) ?? 0) + 1);
  }
  return counts;
}

function buildTallySummary(
  rawRecords: Array<{ candidateId: string | null; ballotType: "valid" | "blank" | "null"; voteCount: number }>,
  participations: Array<{ pollingStationId: string | null }>,
  ballots: Array<{ pollingStationId: string | null }>,
  publication: PublicationInfo | null,
  nameById: Map<string, string>,
  stationNameById: Map<string, string>
): TallySummary {
  const records = rawRecords.map((r) => ({
    candidateId: r.candidateId,
    candidateName: r.candidateId
      ? nameById.get(r.candidateId) ?? "Candidat inconnu"
      : r.ballotType === "blank"
        ? "Vote blanc"
        : "Bulletin nul",
    ballotType: r.ballotType,
    voteCount: r.voteCount,
  }));

  const reconciliation = reconcile(countByStation(participations), countByStation(ballots));
  const stations: StationReconciliation[] = reconciliation.map((r) => ({
    pollingStationId: r.pollingStationId,
    pollingStationLabel: r.pollingStationId
      ? stationNameById.get(r.pollingStationId) ?? "Bureau inconnu"
      : "Non affecté à un bureau",
    participationCount: r.participationCount,
    ballotCount: r.ballotCount,
    consistent: r.consistent,
  }));

  return {
    hasTally: rawRecords.length > 0,
    records,
    participationCount: participations.length,
    ballotCount: ballots.length,
    consistent: stations.every((s) => s.consistent),
    stations,
    publication,
  };
}

export async function getTallySummary(electionId: string): Promise<TallySummary> {
  const [candidates, stations] = await Promise.all([
    listCandidates(electionId),
    listPollingStations(),
  ]);
  const nameById = new Map(candidates.map((c) => [c.id, c.displayName]));
  const stationNameById = new Map(stations.map((s) => [s.id, `${s.name} (${s.code})`]));

  if (!isSupabaseConfigured()) {
    const records = await demo.demoTallyRepository.listForElection(electionId);
    const ballots = await demo.demoBallotRepository.listForElection(electionId);
    const participations = await demo.demoParticipationRepository.listForElection(electionId);
    const publication = await demo.demoResultPublicationRepository.getForElection(electionId);
    return buildTallySummary(
      records,
      participations,
      ballots,
      publication ? { status: publication.status, publishedAt: publication.publishedAt } : null,
      nameById,
      stationNameById
    );
  }

  const client = getServiceRoleClient();

  const { data: tallyRows, error: tallyError } = await client
    .from("tally_records")
    .select("candidate_id, ballot_type, vote_count")
    .eq("election_id", electionId);
  if (tallyError) throw tallyError;

  const { data: ballotRows, error: ballotError } = await client
    .from("encrypted_ballots")
    .select("polling_station_id")
    .eq("election_id", electionId);
  if (ballotError) throw ballotError;

  const { data: participationRows, error: participationError } = await client
    .from("participation_records")
    .select("polling_station_id")
    .eq("election_id", electionId);
  if (participationError) throw participationError;

  const { data: publicationRow, error: publicationError } = await client
    .from("result_publications")
    .select("status, published_at")
    .eq("election_id", electionId)
    .eq("scope_level", "national")
    .maybeSingle();
  if (publicationError) throw publicationError;

  return buildTallySummary(
    (tallyRows ?? []).map((r) => ({
      candidateId: r.candidate_id,
      ballotType: r.ballot_type,
      voteCount: r.vote_count,
    })),
    (participationRows ?? []).map((r) => ({ pollingStationId: r.polling_station_id })),
    (ballotRows ?? []).map((r) => ({ pollingStationId: r.polling_station_id })),
    publicationRow
      ? { status: publicationRow.status, publishedAt: publicationRow.published_at ? new Date(publicationRow.published_at) : null }
      : null,
    nameById,
    stationNameById
  );
}

/** Scrutins dont les resultats ont ete publies (doc 05 §6 - page publique). */
export async function listPublishedElections(): Promise<ElectionSummary[]> {
  const all = await listAllElections();
  const results: ElectionSummary[] = [];
  for (const election of all) {
    const summary = await getTallySummary(election.id);
    if (summary.publication?.status === "published") {
      results.push(election);
    }
  }
  return results;
}

export interface AuditEventSummary {
  id: string;
  actorName: string;
  actionCode: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

export interface AuditChainStatus {
  consistent: boolean;
  checkedCount: number;
}

/**
 * Journal d'audit (doc 05 §6, doc 06 §3) — toujours trie du plus ancien
 * au plus recent pour que la verification de chaine ait un sens, puis
 * inverse pour l'affichage (le plus recent en premier).
 */
export async function listAuditEvents(): Promise<AuditEventSummary[]> {
  if (!isSupabaseConfigured()) {
    const events = await demo.demoAuditRepository.listAll();
    return events
      .map((e) => ({
        id: e.id,
        actorName: e.actorUserId ? demo.getAdminAccount(e.actorUserId)?.fullName ?? "Compte inconnu" : "Système",
        actionCode: e.actionCode,
        targetType: e.targetType,
        targetId: e.targetId,
        metadata: e.metadata,
        occurredAt: e.occurredAt,
      }))
      .reverse();
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("audit_events")
    .select("*")
    .order("occurred_at", { ascending: true });
  if (error) throw error;

  const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_user_id).filter(Boolean)));
  const namesById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: users, error: usersError } = await client
      .from("users")
      .select("id, full_name")
      .in("id", actorIds);
    if (usersError) throw usersError;
    for (const u of users ?? []) namesById.set(u.id, u.full_name);
  }

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      actorName: row.actor_user_id ? namesById.get(row.actor_user_id) ?? "Compte inconnu" : "Système",
      actionCode: row.action_code,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: row.metadata,
      occurredAt: new Date(row.occurred_at),
    }))
    .reverse();
}

export async function getAuditChainStatus(): Promise<AuditChainStatus> {
  if (!isSupabaseConfigured()) {
    const events = await demo.demoAuditRepository.listAll();
    return { consistent: verifyAuditTrail(events) === -1, checkedCount: events.length };
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("audit_events")
    .select("*")
    .order("occurred_at", { ascending: true });
  if (error) throw error;

  const events = (data ?? []).map((row) => ({
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

  return { consistent: verifyAuditTrail(events) === -1, checkedCount: events.length };
}

export async function listIncidents(): Promise<IncidentSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listIncidents().map((i) => ({
      id: i.id,
      electionId: i.electionId,
      category: i.category,
      description: i.description,
      status: i.status,
      openedAt: i.openedAt,
    }));
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("incident_reports")
    .select("*")
    .order("opened_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    electionId: row.election_id,
    category: row.category,
    description: row.description,
    status: row.status,
    openedAt: new Date(row.opened_at),
  }));
}

export async function hasParticipated(voterId: string, electionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return demo.hasParticipated(voterId, electionId);
  }

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("voting_credentials")
    .select("status")
    .eq("demo_voter_id", voterId)
    .eq("election_id", electionId)
    .maybeSingle();

  if (error) throw error;
  return data?.status === "consumed";
}
