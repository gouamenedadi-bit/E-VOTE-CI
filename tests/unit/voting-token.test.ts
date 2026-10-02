import { describe, expect, it } from "vitest";
import { issueVotingToken, consumeVotingToken } from "../../lib/core/voting-token";
import {
  FixedClock,
  InMemoryCredentialRepository,
  InMemoryEligibilityRepository,
  SequentialTokenGenerator,
} from "../fakes/in-memory-repos";

function setup() {
  return {
    eligibilityRepo: new InMemoryEligibilityRepository(),
    credentialRepo: new InMemoryCredentialRepository(),
    tokenGenerator: new SequentialTokenGenerator(),
    clock: new FixedClock(),
  };
}

describe("issueVotingToken", () => {
  it("refuse un electeur non enregistre (test obligatoire #1)", async () => {
    const deps = setup();
    const result = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    expect(result).toEqual({ ok: false, reason: "not_registered" });
  });

  it("refuse un electeur non eligible", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: false,
    });
    const result = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    expect(result).toEqual({ ok: false, reason: "not_eligible" });
  });

  it("emet un jeton pour un electeur eligible", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: true,
    });
    const result = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rawToken).toBeTruthy();
    }
  });

  it("refuse un second jeton pour le meme electeur/scrutin (unicite)", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: true,
    });
    await issueVotingToken({ demoVoterId: "voter-1", electionId: "election-1" }, deps);
    const second = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    expect(second).toEqual({ ok: false, reason: "already_issued" });
  });

  it("autorise un nouveau jeton apres expiration du precedent (reprise de session, doc 05 §1)", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: true,
    });
    const first = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    if (!first.ok) throw new Error("setup failed");

    deps.clock.advanceMs(31 * 60 * 1000);
    // Fait constater l'expiration par une tentative de consommation.
    await consumeVotingToken(first.rawToken, "election-1", deps);

    const second = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    expect(second.ok).toBe(true);
  });
});

describe("consumeVotingToken", () => {
  it("consomme un jeton valide une seule fois (test obligatoire #2)", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: true,
    });
    const issued = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    if (!issued.ok) throw new Error("setup failed");

    const first = await consumeVotingToken(issued.rawToken, "election-1", deps);
    expect(first.ok).toBe(true);

    const second = await consumeVotingToken(issued.rawToken, "election-1", deps);
    expect(second).toEqual({ ok: false, reason: "already_consumed" });
  });

  it("deux consommations simultanees du meme jeton n'en acceptent qu'une (test obligatoire #3)", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: true,
    });
    const issued = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps
    );
    if (!issued.ok) throw new Error("setup failed");

    const [a, b] = await Promise.all([
      consumeVotingToken(issued.rawToken, "election-1", deps),
      consumeVotingToken(issued.rawToken, "election-1", deps),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    expect(successes).toHaveLength(1);
  });

  it("rejette un jeton expire", async () => {
    const deps = setup();
    deps.eligibilityRepo.seed({
      demoVoterId: "voter-1",
      electionId: "election-1",
      pollingStationId: "station-1",
      isEligible: true,
    });
    const issued = await issueVotingToken(
      { demoVoterId: "voter-1", electionId: "election-1" },
      deps,
    );
    if (!issued.ok) throw new Error("setup failed");

    deps.clock.advanceMs(31 * 60 * 1000);
    const result = await consumeVotingToken(issued.rawToken, "election-1", deps);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejette un jeton inconnu", async () => {
    const deps = setup();
    const result = await consumeVotingToken("jeton-invente", "election-1", deps);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
