import { describe, expect, it } from "vitest";
import { reconcile, tallyBallots } from "../../lib/core/tally";
import { encryptBallotPayload } from "../../lib/core/ballot";
import { GENESIS_HASH, computeRecordHash } from "../../lib/core/integrity";
import { FixedMasterKeyProvider } from "../fakes/in-memory-repos";
import type { EncryptedBallot } from "../../lib/core/types";

function makeBallot(
  electionId: string,
  choice: { type: "valid" | "blank" | "null"; candidateId: string | null },
  masterKeyProvider: FixedMasterKeyProvider,
  prevHash: string
): EncryptedBallot {
  const envelope = encryptBallotPayload(choice, masterKeyProvider);
  const content = { electionId, ciphertext: envelope.ciphertext.toString("hex") };
  const recordHash = computeRecordHash(content, prevHash);
  return {
    id: crypto.randomUUID(),
    electionId,
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    authTag: envelope.authTag,
    wrappedDataKey: envelope.wrappedDataKey,
    integrityPrevHash: prevHash,
    integrityRecordHash: recordHash,
    recordedAt: new Date(),
  };
}

describe("tallyBallots", () => {
  it("compte correctement les bulletins valides, blancs et nuls (test obligatoire #8)", () => {
    const masterKeyProvider = new FixedMasterKeyProvider();
    let prevHash = GENESIS_HASH;
    const ballots: EncryptedBallot[] = [];
    const choices = [
      { type: "valid" as const, candidateId: "cand-A" },
      { type: "valid" as const, candidateId: "cand-A" },
      { type: "valid" as const, candidateId: "cand-B" },
      { type: "blank" as const, candidateId: null },
    ];
    for (const choice of choices) {
      const ballot = makeBallot("election-1", choice, masterKeyProvider, prevHash);
      ballots.push(ballot);
      prevHash = ballot.integrityRecordHash;
    }

    const results = tallyBallots("election-1", ballots, new Map(), masterKeyProvider);

    const candA = results.find((r) => r.candidateId === "cand-A");
    const candB = results.find((r) => r.candidateId === "cand-B");
    const blank = results.find((r) => r.ballotType === "blank");

    expect(candA?.voteCount).toBe(2);
    expect(candB?.voteCount).toBe(1);
    expect(blank?.voteCount).toBe(1);
  });
});

describe("reconcile", () => {
  it("detecte un ecart entre participations et bulletins (test obligatoire #9)", () => {
    const participationCounts = new Map([
      ["station-1", 318],
      ["station-2", 290],
    ]);
    const ballotCounts = new Map([
      ["station-1", 312],
      ["station-2", 290],
    ]);

    const result = reconcile(participationCounts, ballotCounts);

    const station1 = result.find((r) => r.pollingStationId === "station-1");
    const station2 = result.find((r) => r.pollingStationId === "station-2");

    expect(station1?.consistent).toBe(false);
    expect(station2?.consistent).toBe(true);
  });
});
