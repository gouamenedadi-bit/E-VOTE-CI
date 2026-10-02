import "server-only";
import { isSupabaseConfigured, getServiceRoleClient } from "./db/supabase-server";
import * as demo from "./demo/store";

/**
 * Requetes de lecture pour l'interface electeur (pas des ports de
 * /lib/core : ce sont des lectures publiques/semi-publiques, pas des
 * operations critiques sur le secret du vote). Memes deux branches
 * demo/Supabase que lib/runtime.ts.
 */

export interface VoterSummary {
  id: string;
  voterNumber: string;
  fullName: string | null;
}

export interface ElectionSummary {
  id: string;
  name: string;
  typeLabel: string;
  status: "open" | "closed";
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

export async function listElectionsForVoter(voterId: string): Promise<ElectionSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listOpenElectionsForVoter(voterId).map((e) => ({
      id: e.id,
      name: e.name,
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
    .select("id, name, starts_at, ends_at, status, election_types(name, allows_blank_ballot)")
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

  return (elections ?? []).map((row) => {
    const electionType = row.election_types as unknown as
      | { name: string; allows_blank_ballot: boolean }
      | { name: string; allows_blank_ballot: boolean }[]
      | null;
    const typeInfo = Array.isArray(electionType) ? electionType[0] : electionType;
    return {
      id: row.id,
      name: row.name,
      typeLabel: typeInfo?.name ?? "",
      status: row.status as "open" | "closed",
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      allowsBlankBallot: typeInfo?.allows_blank_ballot ?? true,
      alreadyVoted: votedElectionIds.has(row.id),
    };
  });
}

export async function getElection(electionId: string): Promise<ElectionSummary | null> {
  if (!isSupabaseConfigured()) {
    const election = demo.getElection(electionId);
    if (!election) return null;
    return {
      id: election.id,
      name: election.name,
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
    .select("id, name, starts_at, ends_at, status, election_types(name, allows_blank_ballot)")
    .eq("id", electionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const electionType = data.election_types as unknown as
    | { name: string; allows_blank_ballot: boolean }
    | { name: string; allows_blank_ballot: boolean }[]
    | null;
  const typeInfo = Array.isArray(electionType) ? electionType[0] : electionType;

  return {
    id: data.id,
    name: data.name,
    typeLabel: typeInfo?.name ?? "",
    status: data.status as "open" | "closed",
    startsAt: new Date(data.starts_at),
    endsAt: new Date(data.ends_at),
    allowsBlankBallot: typeInfo?.allows_blank_ballot ?? true,
    alreadyVoted: false,
  };
}

export async function listCandidates(electionId: string): Promise<CandidateSummary[]> {
  if (!isSupabaseConfigured()) {
    return demo.listCandidates(electionId).map((c) => ({
      id: c.id,
      displayName: c.displayName,
      partyName: c.partyName,
      ballotOrder: c.ballotOrder,
      isBlankOption: c.isBlankOption,
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
