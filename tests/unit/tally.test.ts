import { describe, expect, it } from "vitest";
import { aggregateBallots, reconcile, runTally } from "../../lib/core/tally";
import { encryptBallotPayload } from "../../lib/core/ballot";
import { GENESIS_HASH, computeRecordHash, verifyChain } from "../../lib/core/integrity";
import {
  FixedClock,
  FixedMasterKeyProvider,
  InMemoryAuditRepository,
  InMemoryBallotRepository,
  InMemoryIncidentRepository,
  InMemoryParticipationRepository,
  InMemoryTallyRepository,
} from "../fakes/in-memory-repos";
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
    encryptionKeyId: masterKeyProvider.currentKeyId(),
    integrityPrevHash: prevHash,
    integrityRecordHash: recordHash,
    recordedAt: new Date(),
  };
}

describe("aggregateBallots", () => {
  it("compte correctement les bulletins valides et blancs (test obligatoire #8)", () => {
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

    const results = aggregateBallots(ballots, masterKeyProvider);

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

function setupTallyDeps() {
  return {
    ballotRepo: new InMemoryBallotRepository(),
    participationRepo: new InMemoryParticipationRepository(),
    tallyRepo: new InMemoryTallyRepository(),
    incidentRepo: new InMemoryIncidentRepository(),
    auditRepo: new InMemoryAuditRepository(),
    masterKeyProvider: new FixedMasterKeyProvider(),
    clock: new FixedClock(),
  };
}

describe("runTally", () => {
  it("produit une chaine d'integrite valide et aucun incident quand tout correspond", async () => {
    const deps = setupTallyDeps();
    let prevHash = GENESIS_HASH;
    for (const choice of [
      { type: "valid" as const, candidateId: "cand-A" },
      { type: "valid" as const, candidateId: "cand-B" },
    ]) {
      const ballot = makeBallot("election-1", choice, deps.masterKeyProvider, prevHash);
      await deps.ballotRepo.insert(ballot);
      prevHash = ballot.integrityRecordHash;
      await deps.participationRepo.record({
        id: crypto.randomUUID(),
        electionId: "election-1",
        pollingStationId: null,
        credentialId: crypto.randomUUID(),
        recordedAt: deps.clock.now(),
      });
    }

    const result = await runTally("election-1", deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.consistent).toBe(true);
    expect(result.participationCount).toBe(2);
    expect(result.ballotCount).toBe(2);
    expect(deps.incidentRepo.incidents).toHaveLength(0);

    const chained = result.records.map((r) => ({
      prevHash: r.integrityPrevHash,
      recordHash: r.integrityRecordHash,
      content: {
        electionId: r.electionId,
        candidateId: r.candidateId,
        ballotType: r.ballotType,
        voteCount: r.voteCount,
      },
    }));
    expect(verifyChain(chained)).toBe(-1);
  });

  it("ouvre un incident quand participations et bulletins ne correspondent pas (test obligatoire #9)", async () => {
    const deps = setupTallyDeps();
    const ballot = makeBallot(
      "election-1",
      { type: "valid", candidateId: "cand-A" },
      deps.masterKeyProvider,
      GENESIS_HASH
    );
    await deps.ballotRepo.insert(ballot);
    // Deux participations enregistrees mais un seul bulletin depose.
    for (let i = 0; i < 2; i++) {
      await deps.participationRepo.record({
        id: crypto.randomUUID(),
        electionId: "election-1",
        pollingStationId: null,
        credentialId: crypto.randomUUID(),
        recordedAt: deps.clock.now(),
      });
    }

    const result = await runTally("election-1", deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.consistent).toBe(false);
    expect(deps.incidentRepo.incidents).toHaveLength(1);
    expect(deps.incidentRepo.incidents[0]?.category).toBe("reconciliation_mismatch");
  });

  it("est idempotent : un second depouillement ne recalcule pas et ne duplique rien", async () => {
    const deps = setupTallyDeps();
    const ballot = makeBallot(
      "election-1",
      { type: "valid", candidateId: "cand-A" },
      deps.masterKeyProvider,
      GENESIS_HASH
    );
    await deps.ballotRepo.insert(ballot);

    const first = await runTally("election-1", deps);
    expect(first.ok).toBe(true);

    const second = await runTally("election-1", deps);
    expect(second).toEqual({ ok: false, reason: "already_tallied" });

    const stored = await deps.tallyRepo.listForElection("election-1");
    expect(stored).toHaveLength(1);
  });
});
