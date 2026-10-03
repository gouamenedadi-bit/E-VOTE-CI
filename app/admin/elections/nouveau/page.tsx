import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
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
  await requireAdmin();
  const { erreur } = await searchParams;
  const electionTypes = await listElectionTypes();

  return (
    <main className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/admin" className="text-ci-green font-semibold">
        ← Administration
      </Link>

      <h1 className="text-2xl font-bold text-ci-dark">Nouveau scrutin</h1>

      {erreur && (
        <p role="alert" className="rounded-md bg-red-50 text-red-700 border border-red-200 p-3">
          {ERROR_MESSAGES[erreur] ?? "Erreur de validation."}
        </p>
      )}

      <form action={createElectionAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Type d&apos;élection</span>
          <select
            name="electionTypeId"
            required
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
          >
            {electionTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Nom du scrutin</span>
          <input
            name="name"
            required
            minLength={3}
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            placeholder="ex. Présidentielle — Simulation 2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Description</span>
          <textarea
            name="description"
            rows={3}
            className="rounded-md border border-gray-300 px-3 py-2 text-base"
          />
        </label>

        <div className="flex gap-4">
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-ci-dark">Date et heure de début</span>
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-medium text-ci-dark">Date et heure de fin</span>
            <input
              type="datetime-local"
              name="endsAt"
              required
              className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            />
          </label>
        </div>

        <p className="text-sm text-ci-gray">
          ⓘ Simplification de prototype : tous les électeurs de démonstration sont rendus
          éligibles automatiquement à ce nouveau scrutin (doc 05 §2).
        </p>

        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-ci-green text-white font-semibold hover:bg-ci-green/90"
        >
          Créer le scrutin
        </button>
      </form>
    </main>
  );
}
