import Link from "next/link";
import { identifyAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalide: "Numéro d'électeur ou code de vérification invalide.",
  incorrect: "Numéro d'électeur ou code de vérification incorrect.",
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const errorMessage = erreur ? ERROR_MESSAGES[erreur] : null;

  return (
    <main className="max-w-md mx-auto px-4 py-12 flex flex-col gap-6">
      <Link href="/" className="text-ci-green font-semibold">
        ← Accueil
      </Link>

      <h1 className="text-2xl font-bold text-ci-dark">Connexion électeur (démonstration)</h1>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 text-red-700 border border-red-200 p-3">
          {errorMessage}
        </p>
      )}

      <form action={identifyAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Numéro d&apos;électeur fictif</span>
          <input
            name="voterNumber"
            required
            autoComplete="off"
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            placeholder="ex. 0000001"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Code de vérification</span>
          <input
            name="verificationCode"
            required
            autoComplete="off"
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            placeholder="ex. 123456"
          />
        </label>

        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-ci-green text-white font-semibold text-base hover:bg-ci-green/90"
        >
          Continuer
        </button>
      </form>

      <p className="text-sm text-ci-gray">
        ⓘ Données fictives uniquement — aucune donnée réelle n&apos;est demandée ou vérifiée.
        Comptes de démonstration : 0000001 / 0000002 / 0000003, code 123456.
      </p>
    </main>
  );
}
