import Link from "next/link";
import { redirect } from "next/navigation";
import { getVoterSession } from "@/lib/session";
import { getElection, hasParticipated } from "@/lib/queries";

export default async function RecuPage({
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
  const participated = await hasParticipated(voterId, electionId);

  if (!election || !participated) {
    redirect("/espace");
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12 flex flex-col gap-6 items-center text-center">
      <div className="w-16 h-16 rounded-full bg-ci-green text-white flex items-center justify-center text-3xl">
        ✓
      </div>

      <h1 className="text-2xl font-bold text-ci-dark">Participation enregistrée</h1>

      <div className="border border-gray-200 rounded-md p-4 w-full text-left">
        <p className="text-ci-gray text-sm">Scrutin</p>
        <p className="font-semibold text-ci-dark">{election.name}</p>
      </div>

      <p className="text-ci-gray">
        Votre choix reste secret — il n&apos;est affiché nulle part, y compris sur cette page.
      </p>

      <Link
        href="/espace"
        className="min-h-[44px] flex items-center justify-center rounded-md bg-ci-green text-white font-semibold px-6 hover:bg-ci-green/90 w-full"
      >
        Retour au tableau de bord
      </Link>
    </main>
  );
}
