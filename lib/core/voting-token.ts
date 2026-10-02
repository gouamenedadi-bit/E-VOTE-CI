import { createHash, randomUUID } from "crypto";
import { checkEligibility } from "./eligibility";
import type {
  Clock,
  ConsumeResult,
  CredentialRepository,
  EligibilityRepository,
  ParticipationRepository,
  TokenGenerator,
} from "./ports";
import type { VotingCredential } from "./types";

const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export const secureTokenGenerator: TokenGenerator = {
  generate: () => randomUUID() + randomUUID(),
};

export type IssueTokenResult =
  | { ok: true; rawToken: string; credentialId: string; expiresAt: Date }
  | { ok: false; reason: "not_registered" | "not_eligible" | "already_issued" };

/**
 * Point de separation technique entre identite et bulletin (doc 02 §3.1).
 * Le jeton brut n'est renvoye qu'une fois, jamais persiste en clair :
 * seul son hash est stocke dans voting_credentials.
 */
export async function issueVotingToken(
  params: { demoVoterId: string; electionId: string },
  deps: {
    eligibilityRepo: EligibilityRepository;
    credentialRepo: CredentialRepository;
    tokenGenerator: TokenGenerator;
    clock: Clock;
    ttlMs?: number;
  }
): Promise<IssueTokenResult> {
  const eligibility = await checkEligibility(
    params.demoVoterId,
    params.electionId,
    deps.eligibilityRepo
  );

  if (!eligibility.eligible) {
    return { ok: false, reason: eligibility.reason };
  }

  const existing = await deps.credentialRepo.findActiveCredential(
    params.demoVoterId,
    params.electionId
  );
  if (existing) {
    return { ok: false, reason: "already_issued" };
  }

  const rawToken = deps.tokenGenerator.generate();
  const now = deps.clock.now();
  const ttl = deps.ttlMs ?? DEFAULT_TOKEN_TTL_MS;

  const credential: VotingCredential = {
    id: randomUUID(),
    tokenHash: hashToken(rawToken),
    demoVoterId: params.demoVoterId,
    electionId: params.electionId,
    status: "issued",
    issuedAt: now,
    expiresAt: new Date(now.getTime() + ttl),
    consumedAt: null,
  };

  await deps.credentialRepo.issue(credential);

  return { ok: true, rawToken, credentialId: credential.id, expiresAt: credential.expiresAt };
}

type ConsumeFailureReason = Extract<ConsumeResult, { ok: false }>["reason"];

export type ConsumeTokenOutcome =
  | { ok: true; credential: VotingCredential }
  | { ok: false; reason: ConsumeFailureReason };

/**
 * Consommation atomique du jeton. L'adaptateur reel doit garantir
 * l'atomicite (verrou + transaction) pour qu'aucune requete concurrente
 * ne puisse faire passer deux fois le meme jeton de "issued" a "consumed".
 */
export async function consumeVotingToken(
  rawToken: string,
  electionId: string,
  deps: { credentialRepo: CredentialRepository; clock: Clock }
): Promise<ConsumeTokenOutcome> {
  const tokenHash = hashToken(rawToken);
  const result = await deps.credentialRepo.tryConsume(tokenHash, deps.clock.now());

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  if (result.credential.electionId !== electionId) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, credential: result.credential };
}

export async function recordParticipation(
  credential: { id: string; electionId: string },
  pollingStationId: string | null,
  repo: ParticipationRepository,
  clock: Clock
): Promise<void> {
  await repo.record({
    id: randomUUID(),
    electionId: credential.electionId,
    pollingStationId,
    credentialId: credential.id,
    recordedAt: clock.now(),
  });
}
