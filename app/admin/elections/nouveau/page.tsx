import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canCreateElections } from "@/lib/core/authorization";
import { listElectionTypes } from "@/lib/queries";
import { createElectionAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "1": "Veuillez vérifier les champs du formulaire.",
  dates: "La date de fin doit être après la date de début.",
};

export default async function NouveauScrutinPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const session = await requireAdminSession();
  if (!canCreateElections(session.roles)) {
    redirect("/admin?erreur=forbidden");
  }
  const { erreur } = await searchParams;
  const electionTypes = await listElectionTypes();

  return (
    <main className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/admin" className="text-ci-green font-semibold hover:underline w-fit">
        ← Administration
      </Link>

      <div className="flex flex-col gap-2">
        <div className="ci-flag-rule" />
        <h1 className="text-2xl font-bold text-ci-ink">Nouveau scrutin</h1>
      </div>

      {erreur && (
        <p role="alert" className="rounded-lg bg-red-50 text-red-700 border border-red-200 p-3">
          {ERROR_MESSAGES[erreur] ?? "Erreur de validation."}
        </p>
      )}

      <form action={createElectionAction} className="ci-card flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-ink">Type d&apos;élection</span>
          <select name="electionTypeId" required className="ci-input">
            {electionTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-ink">Nom du scrutin</span>
          <input
            name="name"
            required
            minLength={3}
            className="ci-input"
            placeholder="ex. Présidentielle — Simulation 2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-ink">Description</span>
          <textarea name="description" rows={3} className="ci-input py-2" />
        </label>

        <div className="flex gap-4">
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-ci-ink">Date et heure de début</span>
            <input type="datetime-local" name="startsAt" required className="ci-input" />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-ci-ink">Date et heure de fin</span>
            <input type="datetime-local" name="endsAt" required className="ci-input" />
          </label>
        </div>

        <p className="text-sm text-ci-gray">
          ⓘ Simplification de prototype : tous les électeurs de démonstration sont rendus
          éligibles automatiquement à ce nouveau scrutin (doc 05 §2).
        </p>

        <button type="submit" className="ci-btn-primary">
          Créer le scrutin
        </button>
      </form>
    </main>
  );
}
