import { adminLoginAction } from "./actions";

export default async function AdminConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <main className="max-w-md mx-auto px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ci-dark">Administration — E-VOTE CI</h1>

      <p className="text-sm text-ci-orange bg-orange-50 border border-orange-200 rounded-md p-3">
        ⚠ Authentification simplifiée de prototype (mot de passe unique). Ne remplace pas
        l&apos;authentification forte avec MFA prévue pour un usage réel (doc 04).
      </p>

      {erreur && (
        <p role="alert" className="rounded-md bg-red-50 text-red-700 border border-red-200 p-3">
          Mot de passe incorrect.
        </p>
      )}

      <form action={adminLoginAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Mot de passe administrateur</span>
          <input
            type="password"
            name="password"
            required
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
          />
        </label>

        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-ci-dark text-white font-semibold hover:bg-ci-dark/90"
        >
          Se connecter
        </button>
      </form>
    </main>
  );
}
