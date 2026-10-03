import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canViewAudit } from "@/lib/core/authorization";
import { getAuditChainStatus, listAuditEvents } from "@/lib/queries";

const ACTION_LABELS: Record<string, string> = {
  "election.created": "Création du scrutin",
  "election.status_changed": "Changement de statut du scrutin",
  "candidate.added": "Ajout d'un candidat",
  "polling_station.created": "Création d'un bureau de vote",
  "polling_station.attached": "Rattachement d'un bureau à un scrutin",
  "participation.recorded": "Participation enregistrée",
  "tally.completed": "Dépouillement effectué",
  "results.published": "Publication des résultats",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await requireAdminSession();
  if (!canViewAudit(session.roles)) {
    redirect("/admin?erreur=forbidden");
  }

  const { action: actionFilter } = await searchParams;
  const [allEvents, chainStatus] = await Promise.all([listAuditEvents(), getAuditChainStatus()]);
  const actionCodes = Array.from(new Set(allEvents.map((e) => e.actionCode))).sort();
  const events = actionFilter ? allEvents.filter((e) => e.actionCode === actionFilter) : allEvents;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/admin" className="text-ci-green font-semibold hover:underline w-fit">
        ← Administration
      </Link>

      <div className="flex flex-col gap-2">
        <div className="ci-flag-rule" />
        <h1 className="text-2xl font-bold text-ci-ink">Journal d&apos;audit</h1>
      </div>

      <div
        className="rounded-xl p-4 border"
        style={{
          borderColor: chainStatus.consistent ? "rgba(0,132,61,0.3)" : "#fca5a5",
          background: chainStatus.consistent ? "rgba(0,132,61,0.06)" : "#fef2f2",
        }}
      >
        <p className="font-semibold text-ci-ink">
          {chainStatus.consistent
            ? `✓ Chaîne d'intégrité vérifiée (${chainStatus.checkedCount} événement(s))`
            : "⚠ Altération détectée dans la chaîne d'intégrité"}
        </p>
      </div>

      <form method="get" className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-ci-gray" htmlFor="action-filter">
          Filtrer par action
        </label>
        <select id="action-filter" name="action" defaultValue={actionFilter ?? ""} className="ci-input flex-1 min-w-[200px]">
          <option value="">Toutes les actions</option>
          {actionCodes.map((code) => (
            <option key={code} value={code}>
              {ACTION_LABELS[code] ?? code}
            </option>
          ))}
        </select>
        <button type="submit" className="ci-btn-outline">
          Filtrer
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id} className="ci-card">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ci-ink">
                {ACTION_LABELS[event.actionCode] ?? event.actionCode}
              </span>
              <span className="text-sm text-ci-gray">
                {event.occurredAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
              </span>
            </div>
            <p className="text-sm text-ci-gray">
              Par {event.actorName} · cible : {event.targetType}
              {event.targetId ? ` (${event.targetId.slice(0, 8)}…)` : ""}
            </p>
            {Object.keys(event.metadata).length > 0 && (
              <p className="text-xs text-ci-gray mt-1 font-mono">{JSON.stringify(event.metadata)}</p>
            )}
          </li>
        ))}
        {events.length === 0 && <li className="text-ci-gray text-sm">Aucun événement.</li>}
      </ul>

      <p className="text-sm text-ci-gray">
        ⓘ Aucun choix électoral ni contenu de bulletin n&apos;apparaît jamais dans ce journal — c&apos;est
        une garantie structurelle, pas seulement une convention d&apos;affichage (doc 06 §3, doc 04 §2).
      </p>
    </main>
  );
}
