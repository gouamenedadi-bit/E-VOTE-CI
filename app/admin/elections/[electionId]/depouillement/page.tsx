import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getElection, getTallySummary } from "@/lib/queries";
import { publishResultsAction, runTallyAction } from "./actions";

export default async function DepouillementPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  await requireAdmin();
  const { electionId } = await params;

  const election = await getElection(electionId);
  if (!election) {
    redirect("/admin");
  }
  if (election.status !== "closed") {
    redirect(`/admin/elections/${electionId}`);
  }

  const summary = await getTallySummary(electionId);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href={`/admin/elections/${electionId}`} className="text-ci-green font-semibold">
        ← {election.name}
      </Link>

      <h1 className="text-2xl font-bold text-ci-dark">Dépouillement — {election.name}</h1>

      {!summary.hasTally && (
        <form action={runTallyAction}>
          <input type="hidden" name="electionId" value={electionId} />
          <button
            type="submit"
            className="min-h-[44px] rounded-md bg-ci-dark text-white font-semibold px-5"
          >
            Lancer le dépouillement
          </button>
        </form>
      )}

      {summary.hasTally && (
        <>
          <div
            className={`border rounded-md p-4 ${
              summary.consistent ? "border-ci-green bg-green-50" : "border-ci-orange bg-orange-50"
            }`}
          >
            <p className="font-semibold">
              {summary.consistent ? "✓ Cohérent" : "⚠ Écart détecté"} — {summary.participationCount}{" "}
              participation(s) enregistrée(s), {summary.ballotCount} bulletin(s) décompté(s).
            </p>
            {!summary.consistent && (
              <p className="text-sm text-ci-gray mt-1">
                Un incident a été ouvert automatiquement (centre de conformité). Aucune correction
                silencieuse n&apos;est appliquée (doc 01 §4.4).
              </p>
            )}
          </div>

          {summary.stations.length > 1 && (
            <div>
              <h2 className="font-semibold text-ci-dark mb-2">Contrôle par bureau</h2>
              <ul className="flex flex-col gap-2">
                {summary.stations.map((s) => (
                  <li
                    key={s.pollingStationId ?? "none"}
                    className={`border rounded-md p-3 flex items-center justify-between ${
                      s.consistent ? "border-gray-200" : "border-ci-orange bg-orange-50"
                    }`}
                  >
                    <span>{s.pollingStationLabel}</span>
                    <span className="text-sm">
                      {s.consistent ? "✓" : "⚠"} {s.participationCount} / {s.ballotCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {summary.records.map((r, i) => (
              <li
                key={i}
                className="border border-gray-200 rounded-md p-3 flex items-center justify-between"
              >
                <span>{r.candidateName}</span>
                <span className="font-semibold">{r.voteCount}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            {summary.publication?.status === "published" ? (
              <p className="text-ci-green font-semibold">
                ✓ Résultats publiés le{" "}
                {summary.publication.publishedAt?.toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            ) : (
              <form action={publishResultsAction}>
                <input type="hidden" name="electionId" value={electionId} />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-md bg-ci-green text-white font-semibold px-5 hover:bg-ci-green/90"
                >
                  Publier les résultats
                </button>
              </form>
            )}
            <Link href="/resultats" className="text-ci-green font-semibold text-sm">
              Voir la page publique →
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
