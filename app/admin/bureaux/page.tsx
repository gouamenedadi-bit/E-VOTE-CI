import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManagePollingStations } from "@/lib/core/authorization";
import { listDepartments, listPollingStations, listRegions, listCommunes } from "@/lib/queries";
import { GeographyFields } from "@/components/GeographyFields";
import { createPollingStationAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "1": "Veuillez vérifier les champs du formulaire.",
  code: "Ce code de bureau existe déjà.",
  commune: "Commune invalide.",
};

export default async function BureauxDeVotePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const session = await requireAdminSession();
  if (!canManagePollingStations(session.roles)) {
    redirect("/admin?erreur=forbidden");
  }
  const { erreur } = await searchParams;
  const [stations, regions, departments, communes] = await Promise.all([
    listPollingStations(),
    listRegions(),
    listDepartments(),
    listCommunes(),
  ]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/admin" className="text-ci-green font-semibold hover:underline w-fit">
        ← Administration
      </Link>

      <div className="flex flex-col gap-2">
        <div className="ci-flag-rule" />
        <h1 className="text-2xl font-bold text-ci-ink">Bureaux de vote</h1>
      </div>

      {erreur && (
        <p role="alert" className="rounded-lg bg-red-50 text-red-700 border border-red-200 p-3">
          {ERROR_MESSAGES[erreur] ?? "Erreur de validation."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {stations.map((s) => (
          <li key={s.id} className="ci-card py-3 flex items-center justify-between">
            <span className="text-ci-ink">
              <strong>{s.code}</strong> — {s.name} · {s.communeName} ({s.regionName})
            </span>
            <span className={s.isActive ? "ci-badge-green" : "ci-badge-orange"}>
              {s.isActive ? "Actif" : "Inactif"}
            </span>
          </li>
        ))}
        {stations.length === 0 && <li className="text-ci-gray text-sm">Aucun bureau créé.</li>}
      </ul>

      <h2 className="font-semibold text-ci-ink text-lg">Ajouter un bureau</h2>
      <form action={createPollingStationAction} className="ci-card flex flex-col gap-3 p-5">
        <div className="flex gap-3">
          <input name="code" required placeholder="Code (ex. BV-003)" className="ci-input sm:w-40" />
          <input name="name" required placeholder="Nom (ex. École C)" className="ci-input flex-1" />
        </div>

        <GeographyFields regions={regions} departments={departments} communes={communes} />

        <button type="submit" className="ci-btn-outline self-start">
          + Ajouter
        </button>
      </form>

      <p className="text-sm text-ci-gray">
        ⓘ Pour rattacher un bureau à un scrutin, ouvrez la fiche du scrutin concerné dans
        l&apos;administration des élections. Géographie représentative (un chef-lieu par région) — à
        compléter depuis une source officielle avant un usage réel (voir centre de conformité).
      </p>
    </main>
  );
}
