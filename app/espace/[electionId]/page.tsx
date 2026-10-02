import Link from "next/link";
import { redirect } from "next/navigation";
import { getVoterSession } from "@/lib/session";
import { getElection, hasParticipated, listCandidates } from "@/lib/queries";
import { VoteForm } from "@/components/VoteForm";
import { castVoteAction } from "./actions";

export default async function VotePage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const { electionId } = await params;
  const voterId = await getVoterSession();
  if (!voterId) {
    redirect("/connexion");
  }

  const election = await getElection(electionId);
  if (!election || election.status !== "open") {
    redirect("/espace");
  }

  const alreadyVoted = await hasParticipated(voterId, electionId);
  if (alreadyVoted) {
    redirect(`/espace/${electionId}/recu`);
  }

  const candidates = await listCandidates(electionId);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/espace" className="text-ci-green font-semibold">
        ← Retour
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-ci-dark">{election.name}</h1>
        <p className="text-ci-gray text-sm">
          Scrutin : {election.typeLabel || "Simulation"} · ouvert jusqu&apos;au{" "}
          {election.endsAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>

      <VoteForm electionId={electionId} candidates={candidates} action={castVoteAction} />
    </main>
  );
}
