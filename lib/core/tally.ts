import { randomUUID } from "crypto";
import { appendAuditEvent } from "./audit";
import { decryptBallotPayload } from "./ballot";
import { computeRecordHash } from "./integrity";
import type {
  AuditRepository,
  BallotRepository,
  Clock,
  IncidentRepository,
  MasterKeyProvider,
  ParticipationRepository,
  TallyRepository,
} from "./ports";
import type { BallotType, EncryptedBallot, TallyRecord } from "./types";

interface AggregatedCount {
  pollingStationId: string | null;
  candidateId: string | null;
  ballotType: BallotType;
  voteCount: number;
}

/**
 * Dechiffre chaque bulletin en memoire et agrege les compteurs par bureau
 * de vote puis par candidat/type (doc 01 §4.4 : "resultats par bureau de
 * vote"). Jamais expose cote client : ce module ne s'execute que dans un
 * service serveur dedie (doc 02 §6, doc 05 §4).
 */
export function aggregateBallots(
  ballots: EncryptedBallot[],
  masterKeyProvider: MasterKeyProvider
): AggregatedCount[] {
  const counts = new Map<string, AggregatedCount>();

  for (const ballot of ballots) {
    const choice = decryptBallotPayload(ballot, masterKeyProvider, ballot.encryptionKeyId);
    const bucketKey = `${ballot.pollingStationId ?? "__none__"}:${choice.candidateId ?? `__${choice.type}`}`;
    const existing = counts.get(bucketKey);
    if (existing) {
      existing.voteCount += 1;
    } else {
      counts.set(bucketKey, {
        pollingStationId: ballot.pollingStationId,
        candidateId: choice.candidateId,
        ballotType: choice.type,
        voteCount: 1,
      });
    }
  }

  return Array.from(counts.values());
}

export interface ReconciliationResult {
  pollingStationId: string | null;
  participationCount: number;
  ballotCount: number;
  consistent: boolean;
}

/**
 * Compare les participations enregistrees aux bulletins acceptes, par
 * bureau. Un ecart ne doit jamais etre corrige automatiquement — il
 * declenche un incident (doc 05 §4, doc 06 §2 T6).
 */
export function reconcile(
  participationCounts: Map<string | null, number>,
  ballotCounts: Map<string | null, number>
): ReconciliationResult[] {
  const stations = new Set<string | null>([
    ...participationCounts.keys(),
    ...ballotCounts.keys(),
  ]);

  return Array.from(stations).map((pollingStationId) => {
    const participationCount = participationCounts.get(pollingStationId) ?? 0;
    const ballotCount = ballotCounts.get(pollingStationId) ?? 0;
    return {
      pollingStationId,
      participationCount,
      ballotCount,
      consistent: participationCount === ballotCount,
    };
  });
}

function countBy<T>(items: T[], keyOf: (item: T) => string | null): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export type RunTallyResult =
  | { ok: false; reason: "already_tallied" }
  | {
      ok: true;
      records: TallyRecord[];
      reconciliation: ReconciliationResult[];
    };

/**
 * Orchestration complete du depouillement (doc 05 §4) : agrege les
 * bulletins par bureau, persiste les totaux chaines (doc 06 §3), compare
 * au nombre de participations bureau par bureau, et ouvre un incident
 * par bureau en ecart — jamais de correction automatique silencieuse
 * (doc 01 §4.4).
 *
 * Idempotent par construction : si un depouillement existe deja pour ce
 * scrutin, il n'est pas recalcule (il faudrait une procedure de
 * correction tracee et autorisee, hors perimetre de cet increment).
 */
export async function runTally(
  electionId: string,
  deps: {
    ballotRepo: BallotRepository;
    participationRepo: ParticipationRepository;
    tallyRepo: TallyRepository;
    incidentRepo: IncidentRepository;
    auditRepo: AuditRepository;
    masterKeyProvider: MasterKeyProvider;
    clock: Clock;
  }
): Promise<RunTallyResult> {
  const existing = await deps.tallyRepo.listForElection(electionId);
  if (existing.length > 0) {
    return { ok: false, reason: "already_tallied" };
  }

  const ballots = await deps.ballotRepo.listForElection(electionId);
  const aggregated = aggregateBallots(ballots, deps.masterKeyProvider);

  const participations = await deps.participationRepo.listForElection(electionId);
  const participationCounts = countBy(participations, (p) => p.pollingStationId);
  const ballotCounts = countBy(ballots, (b) => b.pollingStationId);
  const reconciliation = reconcile(participationCounts, ballotCounts);

  let prevHash = await deps.tallyRepo.getLastIntegrityHash(electionId);
  const now = deps.clock.now();
  const records: TallyRecord[] = aggregated.map((entry) => {
    const content = {
      electionId,
      pollingStationId: entry.pollingStationId,
      candidateId: entry.candidateId,
      ballotType: entry.ballotType,
      voteCount: entry.voteCount,
    };
    const recordHash = computeRecordHash(content, prevHash);
    const record: TallyRecord = {
      id: randomUUID(),
      electionId,
      pollingStationId: entry.pollingStationId,
      candidateId: entry.candidateId,
      ballotType: entry.ballotType,
      voteCount: entry.voteCount,
      integrityPrevHash: prevHash,
      integrityRecordHash: recordHash,
      computedAt: now,
    };
    prevHash = recordHash;
    return record;
  });

  await deps.tallyRepo.replaceForElection(electionId, records);

  for (const stationResult of reconciliation) {
    if (stationResult.consistent) continue;
    await deps.incidentRepo.report({
      id: randomUUID(),
      electionId,
      category: "reconciliation_mismatch",
      description:
        (stationResult.pollingStationId ? `Bureau ${stationResult.pollingStationId} — ` : "") +
        `Écart détecté : ${stationResult.participationCount} participation(s) enregistrée(s) contre ${stationResult.ballotCount} bulletin(s) décompté(s).`,
      status: "open",
      openedAt: now,
      resolvedAt: null,
    });
  }

  const consistent = reconciliation.every((r) => r.consistent);

  await appendAuditEvent(
    {
      actorUserId: null,
      actionCode: "tally.completed",
      targetType: "election",
      targetId: electionId,
      metadata: {
        stationCount: reconciliation.length,
        consistent,
      },
    },
    deps
  );

  return { ok: true, records, reconciliation };
}
