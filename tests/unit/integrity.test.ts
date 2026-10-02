import { describe, expect, it } from "vitest";
import { GENESIS_HASH, computeRecordHash, verifyChain, type ChainedRecord } from "../../lib/core/integrity";

function buildChain(contents: Record<string, unknown>[]): ChainedRecord[] {
  const records: ChainedRecord[] = [];
  let prevHash = GENESIS_HASH;
  for (const content of contents) {
    const recordHash = computeRecordHash(content, prevHash);
    records.push({ prevHash, recordHash, content });
    prevHash = recordHash;
  }
  return records;
}

describe("verifyChain", () => {
  it("valide une chaine intacte", () => {
    const chain = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
    expect(verifyChain(chain)).toBe(-1);
  });

  it("detecte l'alteration du contenu d'un enregistrement passe (test obligatoire #10)", () => {
    const chain = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
    // Alteration retroactive du contenu du premier enregistrement, sans
    // recalculer toute la chaine suivante (ce qu'un attaquant ferait).
    chain[0]!.content = { a: 999 };
    expect(verifyChain(chain)).toBe(0);
  });

  it("detecte la suppression d'un enregistrement intermediaire", () => {
    const chain = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
    const tampered = [chain[0]!, chain[2]!];
    expect(verifyChain(tampered)).toBe(1);
  });

  it("produit des hash differents pour un meme contenu avec un prevHash different", () => {
    const h1 = computeRecordHash({ a: 1 }, GENESIS_HASH);
    const h2 = computeRecordHash({ a: 1 }, "autre-hash-precedent");
    expect(h1).not.toBe(h2);
  });
});
