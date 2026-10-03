"use server";

import { redirect } from "next/navigation";
import { getVoterSession } from "@/lib/session";
import { getRuntimeDeps } from "@/lib/runtime";
import { pickPollingStationForVoter } from "@/lib/queries";
import { issueVotingToken, recordParticipation } from "@/lib/core/voting-token";
import { depositBallot } from "@/lib/core/ballot";
import { appendAuditEvent } from "@/lib/core/audit";
import { voteChoiceSchema } from "@/lib/validation/schemas";

/**
 * Emet et consomme le jeton de vote dans la meme action serveur : le
 * navigateur ne manipule jamais le jeton (doc 02 §3.1), seulement le
 * choix de candidat jusqu'a la confirmation. La participation est
 * enregistree a l'emission du jeton (doc 02 §3.1 point 4) ; le depot du
 * bulletin reste idempotent en cas de nouvel essai (doc 05 §1).
 */
export async function castVoteAction(formData: FormData): Promise<void> {
  const voterId = await getVoterSession();
  if (!voterId) {
    redirect("/connexion");
  }

  const parsed = voteChoiceSchema.safeParse({
    electionId: formData.get("electionId"),
    ballotType: formData.get("ballotType"),
    candidateId: formData.get("candidateId") || null,
  });

  if (!parsed.success) {
    redirect("/espace");
  }

  const { electionId, ballotType, candidateId } = parsed.data;
  const deps = getRuntimeDeps();

  const issued = await issueVotingToken({ demoVoterId: voterId, electionId }, deps);

  if (!issued.ok) {
    if (issued.reason === "already_issued") {
      // Deja vote (ou jeton emis non consomme) pour ce scrutin dans ce flux
      // simplifie : rien d'autre ne cree de credential hors de cette action.
      redirect(`/espace/${electionId}/recu`);
    }
    redirect("/espace");
  }

  const pollingStationId = await pickPollingStationForVoter(electionId, voterId);

  await recordParticipation(
    { id: issued.credentialId, electionId },
    pollingStationId,
    deps.participationRepo,
    deps.clock
  );

  const result = await depositBallot(
    {
      rawToken: issued.rawToken,
      electionId,
      choice: { type: ballotType, candidateId: ballotType === "blank" ? null : candidateId },
      pollingStationId,
    },
    deps
  );

  if (!result.ok) {
    redirect("/espace");
  }

  await appendAuditEvent(
    {
      actorUserId: null,
      actionCode: "participation.recorded",
      targetType: "election",
      targetId: electionId,
      metadata: { mode: deps.mode },
    },
    deps
  );

  redirect(`/espace/${electionId}/recu`);
}
