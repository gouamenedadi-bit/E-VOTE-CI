import { createHash } from "crypto";

/**
 * Chainage de hachage append-only (doc 06 - plan de securite, §3).
 * Chaque enregistrement inclut le hash de l'enregistrement precedent ;
 * toute alteration retroactive d'un enregistrement casse la chaine
 * suivante et devient detectable par verifyChain().
 */

export const GENESIS_HASH = "0".repeat(64);

export function canonicalize(content: Record<string, unknown>): string {
  const sortedKeys = Object.keys(content).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    const value = content[key];
    normalized[key] = value instanceof Date ? value.toISOString() : value;
  }
  return JSON.stringify(normalized);
}

export function computeRecordHash(
  content: Record<string, unknown>,
  prevHash: string
): string {
  return createHash("sha256")
    .update(prevHash)
    .update(canonicalize(content))
    .digest("hex");
}

export interface ChainedRecord {
  prevHash: string;
  recordHash: string;
  content: Record<string, unknown>;
}

/**
 * Recalcule la chaine complete et la compare aux hash stockes.
 * Retourne l'index du premier enregistrement invalide, ou -1 si la
 * chaine est intacte.
 */
export function verifyChain(
  records: ChainedRecord[],
  genesisHash: string = GENESIS_HASH
): number {
  let expectedPrev = genesisHash;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record || record.prevHash !== expectedPrev) {
      return i;
    }
    const expectedHash = computeRecordHash(record.content, record.prevHash);
    if (expectedHash !== record.recordHash) {
      return i;
    }
    expectedPrev = record.recordHash;
  }
  return -1;
}
