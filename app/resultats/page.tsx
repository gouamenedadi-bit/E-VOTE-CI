import Link from "next/link";
import { getTallySummary, listPublishedElections } from "@/lib/queries";

export default async function ResultatsPage() {
  const elections = await listPublishedElections();

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/" className="text-ci-green font-semibold">
        ← Accueil
      </Link>

      <h1 className="text-2xl font-bold text-ci-dark">Résultats — Simulation</h1>

      {elections.length === 0 && (
        <p className="text-ci-gray">
          Aucun résultat n&apos;est publié pour le moment. Les résultats ne sont affichés
          qu&apos;après dépouillement et validation, et restent marqués comme provisoires jusqu&apos;à
          vérification complète (doc 01 §4.4, doc 05 §4).
        </p>
      )}

      {elections.map((election) => (
        <ElectionResult key={election.id} electionId={election.id} name={election.name} typeLabel={election.typeLabel} />
      ))}
    </main>
  );
}

async function ElectionResult({
  electionId,
  name,
  typeLabel,
}: {
  electionId: string;
  name: string;
  typeLabel: string;
}) {
  const summary = await getTallySummary(electionId);
  const totalValid = summary.records
    .filter((r) => r.ballotType === "valid")
    .reduce((sum, r) => sum + r.voteCount, 0);
  const totalAll = summary.records.reduce((sum, r) => sum + r.voteCount, 0);

  return (
    <section className="border border-gray-200 rounded-md p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-ci-dark">{name}</h2>
          <p className="text-sm text-ci-gray">{typeLabel}</p>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${
            summary.consistent
              ? "bg-ci-green/10 text-ci-green"
              : "bg-ci-orange/10 text-ci-orange"
          }`}
        >
          {summary.consistent ? "DÉFINITIF" : "PROVISOIRE"}
        </span>
      </div>

      <p className="text-sm text-ci-gray">
        Participation : {summary.participationCount} · Bulletins décomptés : {summary.ballotCount} · Mis
        à jour le{" "}
        {summary.publication?.publishedAt?.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
      </p>

      <ul className="flex flex-col gap-2">
        {summary.records.map((r, i) => {
          const pct = totalAll > 0 ? ((r.voteCount / totalAll) * 100).toFixed(1) : "0.0";
          const isCandidate = r.ballotType === "valid";
          return (
            <li key={i} className="flex items-center gap-3">
              <span className="w-40 truncate">{r.candidateName}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={isCandidate ? "bg-ci-green h-3" : "bg-ci-gray h-3"}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 text-right text-sm font-semibold">{pct}%</span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ci-gray">
        Pourcentages calculés sur {totalAll} bulletin(s) ({totalValid} valide(s)).
      </p>

      <a href={`/resultats/${electionId}/export`} className="text-ci-green font-semibold text-sm">
        Télécharger le procès-verbal (CSV) ↓
      </a>
    </section>
  );
}
