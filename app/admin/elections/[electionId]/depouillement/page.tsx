import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canRunTally } from "@/lib/core/authorization";
import { getElection, getTallySummary } from "@/lib/queries";
import { publishResultsAction, runTallyAction, verifyResultsAction } from "./actions";

export default async function DepouillementPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const session = await requireAdminSession();
  const { electionId } = await params;

  if (!canRunTally(session.roles, electionId)) {
    redirect("/admin?erreur=forbidden");
  }

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
      <Link href={`/admin/elections/${electionId}`} className="text-ci-green font-semibold hover:underline w-fit">
        ← {election.name}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="ci-flag-rule" />
        <h1 className="text-2xl font-bold text-ci-ink">Dépouillement — {election.name}</h1>
      </div>

      {!summary.hasTally && (
        <form action={runTallyAction}>
          <input type="hidden" name="electionId" value={electionId} />
          <button type="submit" className="ci-btn-accent">
            Lancer le dépouillement
          </button>
        </form>
      )}

      {summary.hasTally && (
        <>
          <div
            className="rounded-xl p-4 border"
            style={{
              borderColor: summary.consistent ? "rgba(0,132,61,0.3)" : "rgba(242,118,12,0.35)",
              background: summary.consistent ? "rgba(0,132,61,0.06)" : "rgba(242,118,12,0.08)",
            }}
          >
            <p className="font-semibold text-ci-ink">
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
              <h2 className="font-semibold text-ci-ink mb-2 text-lg">Contrôle par bureau</h2>
              <ul className="flex flex-col gap-2">
                {summary.stations.map((s) => (
                  <li
                    key={s.pollingStationId ?? "none"}
                    className={s.consistent ? "ci-card py-3 flex items-center justify-between" : "ci-card py-3 flex items-center justify-between"}
                    style={!s.consistent ? { borderColor: "rgba(242,118,12,0.4)", background: "rgba(242,118,12,0.06)" } : undefined}
                  >
                    <span className="text-ci-ink">{s.pollingStationLabel}</span>
                    <span className="text-sm text-ci-ink">
                      {s.consistent ? "✓" : "⚠"} {s.participationCount} / {s.ballotCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {summary.records.map((r, i) => (
              <li key={i} className="ci-card py-3 flex items-center justify-between">
                <span className="text-ci-ink">{r.candidateName}</span>
                <span className="font-bold text-ci-ink text-lg">{r.voteCount}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4 flex-wrap">
            {summary.publication?.status === "published" && (
              <p className="text-ci-green font-semibold">
                ✓ Résultats publiés le{" "}
                {summary.publication.publishedAt?.toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
            {summary.publication?.status === "verified" && (
              <form action={publishResultsAction} className="flex flex-col gap-2">
                <input type="hidden" name="electionId" value={electionId} />
                <p className="text-sm text-ci-gray">✓ Résultats vérifiés — prêts à publier.</p>
                <button type="submit" className="ci-btn-primary">
                  Publier les résultats
                </button>
              </form>
            )}
            {(!summary.publication || summary.publication.status === "draft") && (
              <form action={verifyResultsAction}>
                <input type="hidden" name="electionId" value={electionId} />
                <button type="submit" className="ci-btn-outline">
                  Vérifier les résultats
                </button>
              </form>
            )}
            <a
              href={`/admin/elections/${electionId}/depouillement/export`}
              className="text-ci-green font-semibold text-sm hover:underline"
            >
              Exporter le PV (CSV) ↓
            </a>
            <Link href="/resultats" className="text-ci-green font-semibold text-sm hover:underline">
              Voir la page publique →
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
