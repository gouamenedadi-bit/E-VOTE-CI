"use server";

import { redirect } from "next/navigation";
import { identificationSchema } from "@/lib/validation/schemas";
import { lookupVoterByCredentials } from "@/lib/queries";
import { setVoterSession } from "@/lib/session";

export async function identifyAction(formData: FormData): Promise<void> {
  const parsed = identificationSchema.safeParse({
    voterNumber: formData.get("voterNumber"),
    verificationCode: formData.get("verificationCode"),
  });

  if (!parsed.success) {
    redirect("/connexion?erreur=invalide");
  }

  const voter = await lookupVoterByCredentials(
    parsed.data.voterNumber,
    parsed.data.verificationCode
  );

  if (!voter) {
    redirect("/connexion?erreur=incorrect");
  }

  await setVoterSession(voter.id);
  redirect("/espace");
}
