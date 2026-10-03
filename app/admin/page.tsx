import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { listAllElections, listIncidents } from "@/lib/queries";
import { adminLogoutAction } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  closed: "Clôturé",
};

export default async function AdminDashboardPage() {
  await requireAdmin();

  const elections = await listAllElections();
  const incidents = await listIncidents();

  const counts = {
    draft: elections.filter((e) => e.status === "draft").length,
    open: elections.filter((e) => e.status === "open").length,
    closed: elections.filter((e) => e.status === "closed").length,
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ci-dark">Administration — E-VOTE CI</h1>
        <form action={adminLogoutAction}>
          <button type="submit" className="text-sm text-ci-gray underline">
            Déconnexion
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded-md p-4 text-center">
          <p className="text-2xl font-bold text-ci-dark">{counts.draft}</p>
          <p className="text-sm text-ci-gray">En préparation</p>
        </div>
        <div className="border border-gray-200 rounded-md p-4 text-center">
          <p className="text-2xl font-bold text-ci-green">{counts.open}</p>
          <p className="text-sm text-ci-gray">Ouverts</p>
        </div>
        <div className="border border-gray-200 rounded-md p-4 text-center">
          <p className="text-2xl font-bold text-ci-dark">{counts.closed}</p>
          <p className="text-sm text-ci-gray">Clôturés</p>
        </div>
      </div>

      {incidents.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 rounded-md p-4">
          <p className="font-semibold text-ci-orange">⚠ Anomalies à examiner : {incidents.length}</p>
          <ul className="text-sm text-ci-gray mt-2 flex flex-col gap-1">
            {incidents.map((i) => (
              <li key={i.id}>{i.description}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ci-dark">Élections</h2>
        <Link
          href="/admin/elections/nouveau"
          className="min-h-[44px] flex items-center justify-center rounded-md bg-ci-green text-white font-semibold px-4 hover:bg-ci-green/90"
        >
          + Nouveau scrutin
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {elections.map((election) => (
          <li
            key={election.id}
            className="border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-ci-dark">{election.name}</p>
              <p className="text-sm text-ci-gray">
                {election.typeLabel} · {STATUS_LABELS[election.status] ?? election.status}
              </p>
            </div>
            <Link
              href={`/admin/elections/${election.id}`}
              className="min-h-[44px] flex items-center justify-center rounded-md border-2 border-ci-dark text-ci-dark font-semibold px-4"
            >
              Gérer
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
