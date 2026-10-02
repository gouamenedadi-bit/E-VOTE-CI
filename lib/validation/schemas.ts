import { z } from "zod";

/**
 * Le numero d'electeur seul n'est jamais une preuve d'identite suffisante
 * (doc 01 §4.1) : il est toujours valide avec un second facteur.
 */
export const identificationSchema = z.object({
  voterNumber: z
    .string()
    .trim()
    .min(4, "Numéro d'électeur fictif invalide")
    .max(32, "Numéro d'électeur fictif invalide"),
  verificationCode: z
    .string()
    .trim()
    .min(4, "Code de vérification invalide")
    .max(16, "Code de vérification invalide"),
});

export const voteChoiceSchema = z.object({
  electionId: z.string().min(1),
  ballotType: z.enum(["valid", "blank"]),
  candidateId: z.string().nullable(),
});

export type IdentificationInput = z.infer<typeof identificationSchema>;
export type VoteChoiceInput = z.infer<typeof voteChoiceSchema>;
