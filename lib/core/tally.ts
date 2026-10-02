import { decryptBallotPayload } from "./ballot";
import type { MasterKeyProvider } from "./ports";
import type { BallotType, EncryptedBallot, TallyRecord } from "./types";

/**
 * Dechiffre chaque bulletin en memoire et agrege les compteurs. Jamais
 * expose cote client : ce module ne s'execute que dans un service serveur
 * dedie (doc 02 §6, doc 05 §4).
 */
export function tallyBallots(
  electionId: string,
  ballots: EncryptedBallot[],
  candidateKeyIds: Map<string, string>,
  masterKeyProvider: MasterKeyProvider
): TallyRecord[] {
  const counts = new Map<string, { type: BallotType; candidateId: string | null; count: number }>();

  for (const ballot of ballots) {
    const keyId = candidateKeyIds.get(ballot.id) ?? masterKeyProvider.currentKeyId();
    const choice = decryptBallotPayload(ballot, masterKeyProvider, keyId);
    const bucketKey = choice.candidateId ?? `__${choice.type}`;
    const existing = counts.get(bucketKey);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(bucketKey, { type: choice.type, candidateId: choice.candidateId, count: 1 });
    }
  }

  return Array.from(counts.values()).map((entry) => ({
    electionId,
    pollingStationId: null,
    candidateId: entry.candidateId,
    ballotType: entry.type,
    voteCount: entry.count,
  }));
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
