import { describe, expect, it } from "vitest";
import { publishResults, verifyResults } from "../../lib/core/publication";
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

async function seedTally(deps: ReturnType<typeof setup>) {
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
}

describe("verifyResults", () => {
  it("refuse de verifier un scrutin jamais depouille", async () => {
    const deps = setup();
    const result = await verifyResults("election-1", "admin-1", deps);
    expect(result).toEqual({ ok: false, reason: "not_tallied" });
  });

  it("marque les resultats comme verifies et journalise", async () => {
    const deps = setup();
    await seedTally(deps);

    const result = await verifyResults("election-1", "admin-1", deps);
    expect(result).toEqual({ ok: true });

    const publication = await deps.resultPublicationRepo.getForElection("election-1");
    expect(publication?.status).toBe("verified");

    const events = await deps.auditRepo.listAll();
    expect(events.some((e) => e.actionCode === "results.verified" && e.actorUserId === "admin-1")).toBe(true);
  });
});

describe("publishResults", () => {
  it("refuse de publier un scrutin non verifie (test obligatoire : pas de publication directe, doc 01 §4.4)", async () => {
    const deps = setup();
    await seedTally(deps);
    const result = await publishResults("election-1", "admin-1", deps);
    expect(result).toEqual({ ok: false, reason: "not_verified" });
  });

  it("publie un scrutin verifie et journalise l'action avec l'acteur reel", async () => {
    const deps = setup();
    await seedTally(deps);
    await verifyResults("election-1", "admin-1", deps);

    const result = await publishResults("election-1", "admin-2", deps);
    expect(result).toEqual({ ok: true });

    const publication = await deps.resultPublicationRepo.getForElection("election-1");
    expect(publication?.status).toBe("published");

    const events = await deps.auditRepo.listAll();
    expect(events.some((e) => e.actionCode === "results.published" && e.actorUserId === "admin-2")).toBe(true);
  });

  it("refuse de publier deux fois", async () => {
    const deps = setup();
    await seedTally(deps);
    await verifyResults("election-1", "admin-1", deps);
    await publishResults("election-1", "admin-1", deps);

    const second = await publishResults("election-1", "admin-1", deps);
    expect(second).toEqual({ ok: false, reason: "already_published" });
  });
});
