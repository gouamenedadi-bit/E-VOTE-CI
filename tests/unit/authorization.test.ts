import { describe, expect, it } from "vitest";
import {
  canCreateElections,
  canManageElection,
  canManagePollingStations,
  canManageStation,
  canViewAudit,
  visibleElectionIds,
  type RoleAssignment,
} from "../../lib/core/authorization";

function role(partial: Partial<RoleAssignment> & { role: RoleAssignment["role"] }): RoleAssignment {
  return { scopeElectionId: null, scopePollingStationId: null, ...partial };
}

describe("canCreateElections", () => {
  it("autorise le super administrateur", () => {
    expect(canCreateElections([role({ role: "super_admin" })])).toBe(true);
  });
  it("refuse un administrateur electoral (test obligatoire doc04 : pas de creation hors super admin)", () => {
    expect(canCreateElections([role({ role: "election_admin", scopeElectionId: "e1" })])).toBe(false);
  });
  it("refuse l'absence de role", () => {
    expect(canCreateElections([])).toBe(false);
  });
});

describe("canManageElection", () => {
  it("autorise le super administrateur sur n'importe quel scrutin", () => {
    expect(canManageElection([role({ role: "super_admin" })], "e1")).toBe(true);
    expect(canManageElection([role({ role: "super_admin" })], "e2")).toBe(true);
  });

  it("autorise l'administrateur electoral uniquement sur son scrutin attribue", () => {
    const roles = [role({ role: "election_admin", scopeElectionId: "e1" })];
    expect(canManageElection(roles, "e1")).toBe(true);
    expect(canManageElection(roles, "e2")).toBe(false);
  });

  it("refuse un agent de bureau ou un observateur", () => {
    expect(canManageElection([role({ role: "station_agent", scopePollingStationId: "bv1" })], "e1")).toBe(false);
    expect(canManageElection([role({ role: "observer" })], "e1")).toBe(false);
  });
});

describe("canManageStation", () => {
  it("autorise l'agent uniquement sur son bureau attribue", () => {
    const roles = [role({ role: "station_agent", scopePollingStationId: "bv1" })];
    expect(canManageStation(roles, "bv1")).toBe(true);
    expect(canManageStation(roles, "bv2")).toBe(false);
  });

  it("un administrateur electoral ne peut pas agir sur un bureau qui ne lui est pas attribue (doc 06 test #7)", () => {
    const roles = [role({ role: "election_admin", scopeElectionId: "e1" })];
    expect(canManageStation(roles, "bv1")).toBe(false);
  });
});

describe("canManagePollingStations", () => {
  it("reserve la creation de bureaux au super administrateur", () => {
    expect(canManagePollingStations([role({ role: "super_admin" })])).toBe(true);
    expect(canManagePollingStations([role({ role: "election_admin", scopeElectionId: "e1" })])).toBe(false);
  });
});

describe("canViewAudit", () => {
  it("autorise super admin et observateur, refuse les autres", () => {
    expect(canViewAudit([role({ role: "super_admin" })])).toBe(true);
    expect(canViewAudit([role({ role: "observer" })])).toBe(true);
    expect(canViewAudit([role({ role: "election_admin", scopeElectionId: "e1" })])).toBe(false);
    expect(canViewAudit([role({ role: "station_agent", scopePollingStationId: "bv1" })])).toBe(false);
  });
});

describe("visibleElectionIds", () => {
  it("retourne 'all' pour le super administrateur", () => {
    expect(visibleElectionIds([role({ role: "super_admin" })])).toBe("all");
  });

  it("retourne uniquement les scrutins attribues pour un administrateur electoral", () => {
    const roles = [
      role({ role: "election_admin", scopeElectionId: "e1" }),
      role({ role: "election_admin", scopeElectionId: "e2" }),
    ];
    expect(visibleElectionIds(roles)).toEqual(["e1", "e2"]);
  });

  it("retourne une liste vide pour un agent de bureau", () => {
    expect(visibleElectionIds([role({ role: "station_agent", scopePollingStationId: "bv1" })])).toEqual([]);
  });

  it("retourne 'all' pour un observateur (lecture seule, pas de gestion)", () => {
    expect(visibleElectionIds([role({ role: "observer" })])).toBe("all");
  });
});
