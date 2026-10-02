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
        <h1 className="text-2xl font-bold text-ci-dark">
          Bonjour, {voter.fullName ?? `Électeur démo #${voter.voterNumber}`}
        </h1>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-ci-gray underline">
            Déconnexion
          </button>
        </form>
      </div>

      <h2 className="font-semibold text-ci-dark">Scrutins auxquels vous pouvez participer</h2>

      {elections.length === 0 && (
        <p className="text-ci-gray">Aucun scrutin ouvert pour votre compte de démonstration.</p>
      )}

      <ul className="flex flex-col gap-4">
        {elections.map((election) => (
          <li
            key={election.id}
            className="border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-ci-dark">{election.name}</p>
              <p className="text-sm text-ci-gray">
                Ouvert jusqu&apos;au{" "}
                {election.endsAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
            {election.alreadyVoted ? (
              <span className="text-ci-green font-semibold">Déjà voté ✓</span>
            ) : (
              <Link
                href={`/espace/${election.id}`}
                className="min-h-[44px] flex items-center justify-center rounded-md bg-ci-green text-white font-semibold px-5 hover:bg-ci-green/90"
              >
                Voter
              </Link>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
