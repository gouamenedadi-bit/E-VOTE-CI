import { describe, expect, it } from "vitest";
import { decryptBallotPayload, depositBallot } from "../../lib/core/ballot";
import { issueVotingToken } from "../../lib/core/voting-token";
import {
  FixedClock,
  FixedMasterKeyProvider,
  InMemoryBallotRepository,
  InMemoryCredentialRepository,
  InMemoryEligibilityRepository,
  SequentialTokenGenerator,
} from "../fakes/in-memory-repos";

function setup() {
  return {
    eligibilityRepo: new InMemoryEligibilityRepository(),
    credentialRepo: new InMemoryCredentialRepository(),
    ballotRepo: new InMemoryBallotRepository(),
    masterKeyProvider: new FixedMasterKeyProvider(),
    tokenGenerator: new SequentialTokenGenerator(),
    clock: new FixedClock(),
  };
}

describe("depositBallot", () => {
  it("enregistre un bulletin pour un jeton valide", async () => {
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

    const result = await depositBallot(
      { rawToken: issued.rawToken, electionId: "election-1", choice: { type: "valid", candidateId: "cand-A" } },
      deps
    );

    expect(result).toEqual({ ok: true, duplicate: false });
    const ballots = await deps.ballotRepo.listForElection("election-1");
    expect(ballots).toHaveLength(1);
  });

  it("ne cree jamais de second bulletin pour un jeton deja consomme (test obligatoire #3/#12 - reprise de session)", async () => {
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

    const first = await depositBallot(
      { rawToken: issued.rawToken, electionId: "election-1", choice: { type: "valid", candidateId: "cand-A" } },
      deps
    );
    const retry = await depositBallot(
      { rawToken: issued.rawToken, electionId: "election-1", choice: { type: "valid", candidateId: "cand-B" } },
      deps
    );

    expect(first).toEqual({ ok: true, duplicate: false });
    expect(retry).toEqual({ ok: true, duplicate: true });

    const ballots = await deps.ballotRepo.listForElection("election-1");
    expect(ballots).toHaveLength(1);
  });

  it("rejette un jeton invalide sans rien inserer", async () => {
    const deps = setup();
    const result = await depositBallot(
      { rawToken: "jeton-invente", electionId: "election-1", choice: { type: "valid", candidateId: "cand-A" } },
      deps
    );
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
    expect(await deps.ballotRepo.listForElection("election-1")).toHaveLength(0);
  });

  it("ne stocke aucune donnee d'identite dans le bulletin (secret du vote, test obligatoire #5)", async () => {
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

    await depositBallot(
      { rawToken: issued.rawToken, electionId: "election-1", choice: { type: "valid", candidateId: "cand-A" } },
      deps
    );

    const [ballot] = await deps.ballotRepo.listForElection("election-1");
    const keys = Object.keys(ballot as object);
    expect(keys).not.toContain("demoVoterId");
    expect(keys).not.toContain("credentialId");
    expect(keys).not.toContain("voterId");
  });

  it("le dechiffrement restitue exactement le choix encode", async () => {
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

    await depositBallot(
      { rawToken: issued.rawToken, electionId: "election-1", choice: { type: "valid", candidateId: "cand-A" } },
      deps
    );

    const [ballot] = await deps.ballotRepo.listForElection("election-1");
    const decrypted = decryptBallotPayload(ballot!, deps.masterKeyProvider, deps.masterKeyProvider.currentKeyId());
    expect(decrypted).toEqual({ type: "valid", candidateId: "cand-A" });
  });
});
