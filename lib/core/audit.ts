import { randomUUID } from "crypto";
import { computeRecordHash, verifyChain, type ChainedRecord } from "./integrity";
import type { AuditRepository, Clock } from "./ports";
import type { AuditEvent } from "./types";

/**
 * Journal d'audit append-only (doc 03 §6, doc 06 §3). Le contenu d'un
 * bulletin ou le choix d'un electeur n'ont structurellement pas de place
 * dans `metadata` — ce module n'accepte que des champs de suivi
 * administratif (acteur, action, cible), jamais un choix electoral.
 */
export async function appendAuditEvent(
  params: {
    actorUserId: string | null;
    actionCode: string;
    targetType: string;
    targetId: string | null;
    metadata?: Record<string, unknown>;
  },
  deps: { auditRepo: AuditRepository; clock: Clock }
): Promise<AuditEvent> {
  const prevHash = await deps.auditRepo.getLastHash();
  const now = deps.clock.now();

  const content = {
    actorUserId: params.actorUserId,
    actionCode: params.actionCode,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata ?? {},
    occurredAt: now,
  };

  const recordHash = computeRecordHash(content, prevHash);

  const event: AuditEvent = {
    id: randomUUID(),
    actorUserId: params.actorUserId,
    actionCode: params.actionCode,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata ?? {},
    prevHash,
    recordHash,
    occurredAt: now,
  };

  await deps.auditRepo.append(event);
  return event;
}

/**
 * Recalcule la chaine du journal d'audit et verifie qu'aucun
 * enregistrement n'a ete altere retroactivement (doc 06 §3.2). Les
 * evenements doivent etre fournis dans leur ordre d'ecriture (le plus
 * ancien d'abord). Retourne l'index du premier enregistrement invalide,
 * ou -1 si la chaine est intacte.
 */
export function verifyAuditTrail(events: AuditEvent[]): number {
  const chained: ChainedRecord[] = events.map((event) => ({
    prevHash: event.prevHash,
    recordHash: event.recordHash,
    content: {
      actorUserId: event.actorUserId,
      actionCode: event.actionCode,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata,
      occurredAt: event.occurredAt,
    },
  }));
  return verifyChain(chained);
}
