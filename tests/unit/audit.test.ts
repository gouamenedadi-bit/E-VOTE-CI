import { describe, expect, it } from "vitest";
import { appendAuditEvent, verifyAuditTrail } from "../../lib/core/audit";
import { FixedClock, InMemoryAuditRepository } from "../fakes/in-memory-repos";

function setup() {
  return { auditRepo: new InMemoryAuditRepository(), clock: new FixedClock() };
}

describe("verifyAuditTrail", () => {
  it("valide une chaine intacte sur plusieurs evenements", async () => {
    const deps = setup();
    await appendAuditEvent(
      { actorUserId: "admin-1", actionCode: "election.created", targetType: "election", targetId: "e1" },
      deps
    );
    await appendAuditEvent(
      { actorUserId: "admin-1", actionCode: "election.status_changed", targetType: "election", targetId: "e1", metadata: { newStatus: "open" } },
      deps
    );

    const events = await deps.auditRepo.listAll();
    expect(verifyAuditTrail(events)).toBe(-1);
  });

  it("detecte une alteration retroactive d'un evenement (doc 06 §3.2, test obligatoire #10/#11)", async () => {
    const deps = setup();
    await appendAuditEvent(
      { actorUserId: "admin-1", actionCode: "election.created", targetType: "election", targetId: "e1" },
      deps
    );
    await appendAuditEvent(
      { actorUserId: "admin-1", actionCode: "election.status_changed", targetType: "election", targetId: "e1" },
      deps
    );

    const events = await deps.auditRepo.listAll();
    // Un attaquant (ou un bug) modifie l'action du premier evenement sans
    // recalculer la chaine suivante.
    events[0]!.actionCode = "election.deleted";

    expect(verifyAuditTrail(events)).toBe(0);
  });

  it("ne contient jamais de choix electoral — seuls les champs de suivi administratif existent", async () => {
    const deps = setup();
    const event = await appendAuditEvent(
      { actorUserId: null, actionCode: "participation.recorded", targetType: "election", targetId: "e1", metadata: { mode: "demo" } },
      deps
    );
    expect(Object.keys(event)).not.toContain("candidateId");
    expect(Object.keys(event)).not.toContain("ballotChoice");
  });
});
