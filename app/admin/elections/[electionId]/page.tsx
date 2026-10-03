import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageElection, canManagePollingStations } from "@/lib/core/authorization";
import { getElection, listCandidates, listPollingStations, listPollingStationsForElection } from "@/lib/queries";
import { attachPollingStationAction } from "../../bureaux/actions";
import { addCandidateAction, changeElectionStatusAction } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  closed: "Clôturé",
};

export default async function ManageElectionPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const session = await requireAdminSession();
  const { electionId } = await params;

  const election = await getElection(electionId);
  if (!election) {
    redirect("/admin");
  }
  if (!canManageElection(session.roles, electionId)) {
    redirect("/admin?erreur=forbidden");
  }

  const candidates = await listCandidates(electionId);
  const [allStations, attachedStations] = await Promise.all([
    listPollingStations(),
    listPollingStationsForElection(electionId),
  ]);
  const attachedIds = new Set(attachedStations.map((s) => s.id));
  const availableStations = allStations.filter((s) => !attachedIds.has(s.id));

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/admin" className="text-ci-green font-semibold">
        ← Administration
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-ci-dark">{election.name}</h1>
        <p className="text-ci-gray text-sm">
          {election.typeLabel} · {STATUS_LABELS[election.status] ?? election.status} ·{" "}
          {election.startsAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} →{" "}
          {election.endsAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </p>
        {election.description && <p className="text-ci-gray mt-2">{election.description}</p>}
      </div>

      <div className="flex gap-3">
        {election.status === "draft" && (
          <form action={changeElectionStatusAction}>
            <input type="hidden" name="electionId" value={electionId} />
            <input type="hidden" name="newStatus" value="open" />
            <button
              type="submit"
              className="min-h-[44px] rounded-md bg-ci-green text-white font-semibold px-5 hover:bg-ci-green/90"
            >
              Ouvrir le scrutin
            </button>
          </form>
        )}
        {election.status === "open" && (
          <form action={changeElectionStatusAction}>
            <input type="hidden" name="electionId" value={electionId} />
            <input type="hidden" name="newStatus" value="closed" />
            <button
              type="submit"
              className="min-h-[44px] rounded-md bg-ci-orange text-white font-semibold px-5 hover:bg-ci-orange/90"
            >
              Clôturer le scrutin
            </button>
          </form>
        )}
        {election.status === "closed" && (
          <Link
            href={`/admin/elections/${electionId}/depouillement`}
            className="min-h-[44px] flex items-center justify-center rounded-md bg-ci-dark text-white font-semibold px-5"
          >
            Module de dépouillement
          </Link>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-ci-dark mb-3">Candidats</h2>
        <ul className="flex flex-col gap-2 mb-4">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="border border-gray-200 rounded-md p-3 flex items-center justify-between"
            >
              <span>
                N°{c.ballotOrder} — {c.displayName}
                {c.partyName ? ` — ${c.partyName}` : ""}
              </span>
            </li>
          ))}
          {candidates.length === 0 && <li className="text-ci-gray text-sm">Aucun candidat ajouté.</li>}
        </ul>

        {election.status === "draft" && (
          <form action={addCandidateAction} className="flex flex-col sm:flex-row gap-3">
            <input type="hidden" name="electionId" value={electionId} />
            <input
              name="displayName"
              required
              placeholder="Nom du candidat"
              className="flex-1 min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            />
            <input
              name="partyName"
              placeholder="Parti (optionnel)"
              className="flex-1 min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-md border-2 border-ci-dark text-ci-dark font-semibold px-5"
            >
              + Ajouter
            </button>
          </form>
        )}
        {election.status !== "draft" && (
          <p className="text-sm text-ci-gray">
            Les candidats ne peuvent être ajoutés que tant que le scrutin est en brouillon.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-ci-dark mb-3">Bureaux concernés</h2>
        <ul className="flex flex-col gap-2 mb-4">
          {attachedStations.map((s) => (
            <li key={s.id} className="border border-gray-200 rounded-md p-3">
              <strong>{s.code}</strong> — {s.name} · {s.communeName}
            </li>
          ))}
          {attachedStations.length === 0 && (
            <li className="text-ci-gray text-sm">
              Aucun bureau rattaché — les bulletins de ce scrutin ne seront pas ventilés par bureau.
            </li>
          )}
        </ul>

        {election.status !== "closed" && availableStations.length > 0 && (
          <form action={attachPollingStationAction} className="flex gap-3">
            <input type="hidden" name="electionId" value={electionId} />
            <select
              name="pollingStationId"
              required
              className="flex-1 min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            >
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.communeName})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-[44px] rounded-md border-2 border-ci-dark text-ci-dark font-semibold px-5"
            >
              + Rattacher
            </button>
          </form>
        )}
        {election.status !== "closed" && availableStations.length === 0 && allStations.length > 0 && (
          <p className="text-sm text-ci-gray">Tous les bureaux existants sont déjà rattachés.</p>
        )}
        {allStations.length === 0 && (
          <p className="text-sm text-ci-gray">
            Aucun bureau n&apos;existe encore.
            {canManagePollingStations(session.roles) && (
              <>
                {" "}
                <Link href="/admin/bureaux" className="text-ci-green font-semibold">
                  En créer un
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>
    </main>
  );
}
