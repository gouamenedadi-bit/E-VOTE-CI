import "server-only";
import { secureTokenGenerator } from "./core/voting-token";
import type { Clock, TokenGenerator } from "./core/ports";
import { createMasterKeyProvider } from "./db/master-key-provider";
import { isSupabaseConfigured, getServiceRoleClient } from "./db/supabase-server";
import {
  SupabaseAuditRepository,
  SupabaseBallotRepository,
  SupabaseCredentialRepository,
  SupabaseEligibilityRepository,
  SupabaseIncidentRepository,
  SupabaseParticipationRepository,
  SupabaseResultPublicationRepository,
  SupabaseTallyRepository,
} from "./db/repositories/supabase-repositories";
import {
  demoAuditRepository,
  demoBallotRepository,
  demoClock,
  demoCredentialRepository,
  demoEligibilityRepository,
  demoIncidentRepository,
  demoParticipationRepository,
  demoResultPublicationRepository,
  demoTallyRepository,
} from "./demo/store";

/**
 * Choisit les adaptateurs Supabase si l'environnement est configure,
 * sinon retombe sur le magasin de demonstration en memoire (lib/demo).
 * C'est le seul endroit ou ce choix est fait — /lib/core ne le connait
 * jamais (doc 02 §2).
 */
export function getRuntimeDeps() {
  const masterKeyProvider = createMasterKeyProvider();
  const tokenGenerator: TokenGenerator = secureTokenGenerator;

  if (isSupabaseConfigured()) {
    const client = getServiceRoleClient();
    const clock: Clock = { now: () => new Date() };
    return {
      mode: "supabase" as const,
      eligibilityRepo: new SupabaseEligibilityRepository(client),
      credentialRepo: new SupabaseCredentialRepository(client),
      participationRepo: new SupabaseParticipationRepository(client),
      ballotRepo: new SupabaseBallotRepository(client),
      auditRepo: new SupabaseAuditRepository(client),
      tallyRepo: new SupabaseTallyRepository(client),
      incidentRepo: new SupabaseIncidentRepository(client),
      resultPublicationRepo: new SupabaseResultPublicationRepository(client),
      masterKeyProvider,
      clock,
      tokenGenerator,
    };
  }

  return {
    mode: "demo" as const,
    eligibilityRepo: demoEligibilityRepository,
    credentialRepo: demoCredentialRepository,
    participationRepo: demoParticipationRepository,
    ballotRepo: demoBallotRepository,
    auditRepo: demoAuditRepository,
    tallyRepo: demoTallyRepository,
    incidentRepo: demoIncidentRepository,
    resultPublicationRepo: demoResultPublicationRepository,
    masterKeyProvider,
    clock: demoClock,
    tokenGenerator,
  };
}
