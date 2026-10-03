/**
 * Modele de roles et permissions (doc 04). Logique pure, testable sans
 * Next.js ni Supabase — appelee a la fois par le magasin de demonstration
 * et par les pages/actions admin, pour que la regle de scope soit
 * verifiee de la meme facon quel que soit le backend (defense en
 * profondeur : la RLS Supabase l'applique aussi, independamment, doc 04 §3).
 */

export type AdminRole = "super_admin" | "election_admin" | "station_agent" | "observer";

export interface RoleAssignment {
  role: AdminRole;
  scopeElectionId: string | null;
  scopePollingStationId: string | null;
}

export function isSuperAdmin(roles: RoleAssignment[]): boolean {
  return roles.some((r) => r.role === "super_admin");
}

export function isObserver(roles: RoleAssignment[]): boolean {
  return roles.some((r) => r.role === "observer");
}

/** Creer un scrutin, le configurer de zero : reserve au super administrateur (doc 04 §2). */
export function canCreateElections(roles: RoleAssignment[]): boolean {
  return isSuperAdmin(roles);
}

/**
 * Gerer un scrutin existant (statut, candidats, bureaux) : super admin,
 * ou administrateur electoral attribue a CE scrutin precis.
 */
export function canManageElection(roles: RoleAssignment[], electionId: string): boolean {
  return roles.some(
    (r) =>
      r.role === "super_admin" ||
      (r.role === "election_admin" && r.scopeElectionId === electionId)
  );
}

/**
 * Lister les scrutins visibles pour la navigation admin (filtre de
 * portee). Un observateur voit tous les scrutins (lecture seule des
 * informations publiables, doc 04 §2), mais ne peut en gerer aucun —
 * voir canManageElection, qui refuse toujours l'observateur.
 */
export function visibleElectionIds(roles: RoleAssignment[]): "all" | string[] {
  if (isSuperAdmin(roles) || isObserver(roles)) return "all";
  const scoped = roles
    .filter((r) => r.role === "election_admin" && r.scopeElectionId)
    .map((r) => r.scopeElectionId!);
  return scoped;
}

/** Verifier/agir sur un bureau precis : super admin, ou agent attribue a CE bureau. */
export function canManageStation(roles: RoleAssignment[], pollingStationId: string): boolean {
  return roles.some(
    (r) =>
      r.role === "super_admin" ||
      (r.role === "station_agent" && r.scopePollingStationId === pollingStationId)
  );
}

export function assignedStationIds(roles: RoleAssignment[]): string[] {
  return roles
    .filter((r) => r.role === "station_agent" && r.scopePollingStationId)
    .map((r) => r.scopePollingStationId!);
}

/** Gerer les bureaux de vote (creation) : reserve au super administrateur. */
export function canManagePollingStations(roles: RoleAssignment[]): boolean {
  return isSuperAdmin(roles);
}

/** Lancer un depouillement ou publier un resultat : super admin, ou admin du scrutin. */
export function canRunTally(roles: RoleAssignment[], electionId: string): boolean {
  return canManageElection(roles, electionId);
}

/**
 * Consulter le journal d'audit : super admin toujours, observateur avec
 * autorisation (simplifie ici a "tout observateur", doc 04 §2 note
 * "si autorise" — l'octroi granulaire par observateur est hors perimetre
 * de ce prototype).
 */
export function canViewAudit(roles: RoleAssignment[]): boolean {
  return isSuperAdmin(roles) || isObserver(roles);
}

/**
 * Aucun role, y compris super_admin, ne doit jamais pouvoir retrouver le
 * choix individuel d'un electeur (doc 04 §2) — rappel structurel : cette
 * fonction n'existe pas et ne doit jamais etre ajoutee.
 */
