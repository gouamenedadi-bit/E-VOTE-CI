import Link from "next/link";
import { redirect } from "next/navigation";
import { getVoterSession } from "@/lib/session";
import { getVoter, listElectionsForVoter } from "@/lib/queries";
import { logoutAction } from "./actions";

export default async function EspaceElecteurPage() {
  const voterId = await getVoterSession();
  if (!voterId) {
    redirect("/connexion");
  }

  const voter = await getVoter(voterId);
  if (!voter) {
    redirect("/connexion");
  }

  const elections = await listElectionsForVoter(voterId);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="ci-flag-rule mb-2" />
          <h1 className="text-2xl font-bold text-ci-ink">
            Bonjour, {voter.fullName ?? `Électeur démo #${voter.voterNumber}`}
          </h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-ci-gray underline hover:text-ci-ink">
            Déconnexion
          </button>
        </form>
      </div>

      <h2 className="font-semibold text-ci-ink text-lg">Scrutins auxquels vous pouvez participer</h2>

      {elections.length === 0 && (
        <p className="text-ci-gray">Aucun scrutin ouvert pour votre compte de démonstration.</p>
      )}

      <ul className="flex flex-col gap-4">
        {elections.map((election) => (
          <li key={election.id} className="ci-card flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-ci-ink text-lg">{election.name}</p>
              <p className="text-sm text-ci-gray">
                Ouvert jusqu&apos;au{" "}
                {election.endsAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
            {election.alreadyVoted ? (
              <span className="ci-badge-green">Déjà voté ✓</span>
            ) : (
              <Link href={`/espace/${election.id}`} className="ci-btn-primary">
                Voter
              </Link>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
