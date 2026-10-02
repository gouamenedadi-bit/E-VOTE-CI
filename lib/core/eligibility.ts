import type { EligibilityRepository } from "./ports";

export type EligibilityCheckResult =
  | { eligible: true; pollingStationId: string | null }
  | { eligible: false; reason: "not_registered" | "not_eligible" };

/**
 * Le numero d'electeur seul n'est jamais une preuve suffisante (doc 01 §4.1) :
 * cette fonction suppose que l'appelant a deja authentifie le demoVoterId
 * (ex. second facteur) avant de verifier son eligibilite pour le scrutin.
 */
export async function checkEligibility(
  demoVoterId: string,
  electionId: string,
  repo: EligibilityRepository
): Promise<EligibilityCheckResult> {
  const eligibility = await repo.findEligibility(demoVoterId, electionId);

  if (!eligibility) {
    return { eligible: false, reason: "not_registered" };
  }

  if (!eligibility.isEligible) {
    return { eligible: false, reason: "not_eligible" };
  }

  return { eligible: true, pollingStationId: eligibility.pollingStationId };
}
