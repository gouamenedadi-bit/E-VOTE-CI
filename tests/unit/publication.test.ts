import { describe, expect, it } from "vitest";
import { publishResults } from "../../lib/core/publication";
import {
  FixedClock,
  InMemoryAuditRepository,
  InMemoryResultPublicationRepository,
  InMemoryTallyRepository,
} from "../fakes/in-memory-repos";

function setup() {
  return {
    tallyRepo: new InMemoryTallyRepository(),
    resultPublicationRepo: new InMemoryResultPublicationRepository(),
    auditRepo: new InMemoryAuditRepository(),
    clock: new FixedClock(),
  };
}

describe("publishResults", () => {
  it("refuse de publier un scrutin jamais depouille", async () => {
    const deps = setup();
    const result = await publishResults("election-1", deps);
    expect(result).toEqual({ ok: false, reason: "not_tallied" });
  });

  it("publie un scrutin depouille et journalise l'action", async () => {
    const deps = setup();
    await deps.tallyRepo.replaceForElection("election-1", [
      {
        id: "t1",
        electionId: "election-1",
        pollingStationId: null,
        candidateId: "cand-A",
        ballotType: "valid",
        voteCount: 1,
        integrityPrevHash: "0".repeat(64),
        integrityRecordHash: "a".repeat(64),
        computedAt: deps.clock.now(),
      },
    ]);

    const result = await publishResults("election-1", deps);
    expect(result).toEqual({ ok: true });

    const publication = await deps.resultPublicationRepo.getForElection("election-1");
    expect(publication?.status).toBe("published");

    const events = await deps.auditRepo.listAll();
    expect(events.some((e) => e.actionCode === "results.published")).toBe(true);
  });

  it("refuse de publier deux fois", async () => {
    const deps = setup();
    await deps.tallyRepo.replaceForElection("election-1", [
      {
        id: "t1",
        electionId: "election-1",
        pollingStationId: null,
        candidateId: "cand-A",
        ballotType: "valid",
        voteCount: 1,
        integrityPrevHash: "0".repeat(64),
        integrityRecordHash: "a".repeat(64),
        computedAt: deps.clock.now(),
      },
    ]);
    await publishResults("election-1", deps);
    const second = await publishResults("election-1", deps);
    expect(second).toEqual({ ok: false, reason: "already_published" });
  });
});
