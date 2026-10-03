import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { assignedStationIds } from "@/lib/core/authorization";
import {
  countParticipationsAtStation,
  getPollingStation,
  listElectionsForStation,
} from "@/lib/queries";
import { adminLogoutAction } from "../actions";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  closed: "Clôturé",
};

export default async function MonBureauPage() {
  const session = await requireAdminSession();
  const stationIds = assignedStationIds(session.roles);
  const stationId = stationIds[0];

  if (!stationId) {
    redirect("/admin");
  }

  const station = await getPollingStation(stationId);
  if (!station) {
    redirect("/admin");
  }

  const elections = await listElectionsForStation(stationId);
  const counts = await Promise.all(
    elections.map((e) => countParticipationsAtStation(e.id, stationId))
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="ci-flag-rule mb-2" />
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ci-ink">Mon bureau</h1>
        <form action={adminLogoutAction}>
          <button type="submit" className="text-sm text-ci-gray underline hover:text-ci-ink">
            Déconnexion
          </button>
        </form>
      </div>

      <div className="ci-card ci-card--accent-green">
        <p className="font-semibold text-ci-ink text-lg">
          {station.code} — {station.name}
        </p>
        <p className="text-sm text-ci-gray">{station.communeName}</p>
      </div>

      <h2 className="font-semibold text-ci-ink text-lg">Scrutins rattachés à ce bureau</h2>
      <ul className="flex flex-col gap-2">
        {elections.map((election, i) => (
          <li key={election.id} className="ci-card py-3 flex items-center justify-between">
            <span className="text-ci-ink">
              {election.name} · {STATUS_LABELS[election.status] ?? election.status}
            </span>
            <span className="text-sm text-ci-gray">{counts[i]} participation(s)</span>
          </li>
        ))}
        {elections.length === 0 && (
          <li className="text-ci-gray text-sm">Aucun scrutin rattaché à ce bureau pour le moment.</li>
        )}
      </ul>

      <p className="text-sm text-ci-gray">
        ⓘ Un agent de bureau ne peut consulter que son propre bureau — il ne peut ni modifier un
        bulletin déjà déposé, ni administrer un autre bureau (doc 04 §1).
      </p>
    </main>
  );
}
