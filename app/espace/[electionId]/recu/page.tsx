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
      <div
        className="w-20 h-20 rounded-full bg-ci-green text-white flex items-center justify-center text-4xl ci-animate-in"
        style={{ boxShadow: "0 8px 24px -4px rgba(0,132,61,0.45)" }}
      >
        ✓
      </div>

      <h1 className="text-2xl font-bold text-ci-ink">Participation enregistrée</h1>

      <div className="ci-card w-full text-left">
        <p className="text-ci-gray text-sm">Scrutin</p>
        <p className="font-semibold text-ci-ink text-lg">{election.name}</p>
      </div>

      <p className="text-ci-gray">
        Votre choix reste secret — il n&apos;est affiché nulle part, y compris sur cette page.
      </p>

      <Link href="/espace" className="ci-btn-primary w-full">
        Retour au tableau de bord
      </Link>
    </main>
  );
}
