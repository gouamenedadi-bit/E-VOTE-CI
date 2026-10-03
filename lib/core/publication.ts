import { randomUUID } from "crypto";
import { appendAuditEvent } from "./audit";
import type { AuditRepository, Clock, ResultPublicationRepository, TallyRepository } from "./ports";

type Deps = {
  tallyRepo: TallyRepository;
  resultPublicationRepo: ResultPublicationRepository;
  auditRepo: AuditRepository;
  clock: Clock;
};

export type VerifyResultsOutcome =
  | { ok: true }
  | { ok: false; reason: "not_tallied" | "already_verified" };

/**
 * Premiere etape du workflow de publication a plusieurs niveaux (doc
 * 01 §4.4 : "brouillon -> verifie -> publie") : marque les resultats
 * comme verifies, prealable obligatoire a la publication. Peut etre
 * realisee par une personne differente de celle qui a lance le
 * depouillement (double controle, doc 04 §4), mais ce prototype ne
 * l'impose pas techniquement — a durcir avant un usage reel.
 */
export async function verifyResults(
  electionId: string,
  actorUserId: string | null,
  deps: Deps
): Promise<VerifyResultsOutcome> {
  const tallyRecords = await deps.tallyRepo.listForElection(electionId);
  if (tallyRecords.length === 0) {
    return { ok: false, reason: "not_tallied" };
  }

  const existing = await deps.resultPublicationRepo.getForElection(electionId);
  if (existing?.status === "verified" || existing?.status === "published") {
    return { ok: false, reason: "already_verified" };
  }

  await deps.resultPublicationRepo.upsert({
    id: existing?.id ?? randomUUID(),
    electionId,
    scopeLevel: "national",
    status: "verified",
    publishedAt: null,
  });

  await appendAuditEvent(
    { actorUserId, actionCode: "results.verified", targetType: "election", targetId: electionId, metadata: {} },
    deps
  );

  return { ok: true };
}

export type PublishResultsOutcome =
  | { ok: true }
  | { ok: false; reason: "not_verified" | "already_published" };

/**
 * Seconde etape : publication effective. Exige que l'etape de
 * verification ait deja ete franchie — jamais de publication directe
 * depuis un depouillement non verifie (doc 01 §4.4).
 */
export async function publishResults(
  electionId: string,
  actorUserId: string | null,
  deps: Deps
): Promise<PublishResultsOutcome> {
  const existing = await deps.resultPublicationRepo.getForElection(electionId);
  if (existing?.status === "published") {
    return { ok: false, reason: "already_published" };
  }
  if (existing?.status !== "verified") {
    return { ok: false, reason: "not_verified" };
  }

  const now = deps.clock.now();
  await deps.resultPublicationRepo.upsert({
    id: existing.id,
    electionId,
    scopeLevel: "national",
    status: "published",
    publishedAt: now,
  });

  await appendAuditEvent(
    { actorUserId, actionCode: "results.published", targetType: "election", targetId: electionId, metadata: {} },
    deps
  );

  return { ok: true };
}
