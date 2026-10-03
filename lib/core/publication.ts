import { randomUUID } from "crypto";
import { appendAuditEvent } from "./audit";
import type { AuditRepository, Clock, ResultPublicationRepository, TallyRepository } from "./ports";

export type PublishResultsOutcome =
  | { ok: true }
  | { ok: false; reason: "not_tallied" | "already_published" };

/**
 * Publication des resultats (doc 05 §4). Exige qu'un depouillement ait
 * deja ete effectue — jamais de publication sans decompte verifiable
 * (doc 01 §4.4). La publication elle-meme est journalisee.
 */
export async function publishResults(
  electionId: string,
  deps: {
    tallyRepo: TallyRepository;
    resultPublicationRepo: ResultPublicationRepository;
    auditRepo: AuditRepository;
    clock: Clock;
  }
): Promise<PublishResultsOutcome> {
  const tallyRecords = await deps.tallyRepo.listForElection(electionId);
  if (tallyRecords.length === 0) {
    return { ok: false, reason: "not_tallied" };
  }

  const existing = await deps.resultPublicationRepo.getForElection(electionId);
  if (existing?.status === "published") {
    return { ok: false, reason: "already_published" };
  }

  const now = deps.clock.now();
  await deps.resultPublicationRepo.upsert({
    id: existing?.id ?? randomUUID(),
    electionId,
    scopeLevel: "national",
    status: "published",
    publishedAt: now,
  });

  await appendAuditEvent(
    {
      actorUserId: null,
      actionCode: "results.published",
      targetType: "election",
      targetId: electionId,
      metadata: {},
    },
    deps
  );

  return { ok: true };
}
