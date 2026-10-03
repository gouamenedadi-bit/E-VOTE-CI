import { computeTotp } from "@/lib/core/totp";
import { isSupabaseConfigured } from "@/lib/db/supabase-server";
import { listAdminAccounts } from "@/lib/demo/store";
import { adminLoginAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  invalid_mfa: "Code de vérification incorrect ou expiré.",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  election_admin: "Administrateur électoral",
  station_agent: "Agent de bureau",
  observer: "Observateur",
};

export default async function AdminConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const demoMode = !isSupabaseConfigured();
  const demoAccounts = demoMode ? listAdminAccounts() : [];

  return (
    <main className="max-w-md mx-auto px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ci-dark">Administration — E-VOTE CI</h1>

      <p className="text-sm text-ci-orange bg-orange-50 border border-orange-200 rounded-md p-3">
        ⚠ Authentification à deux facteurs (mot de passe + code à usage unique). En mode
        Supabase, délègue à Supabase Auth/MFA — non vérifié en direct sans projet réel (doc 04).
      </p>

      {erreur && (
        <p role="alert" className="rounded-md bg-red-50 text-red-700 border border-red-200 p-3">
          {ERROR_MESSAGES[erreur] ?? "Erreur de connexion."}
        </p>
      )}

      <form action={adminLoginAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Email</span>
          <input
            type="email"
            name="email"
            required
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Mot de passe</span>
          <input
            type="password"
            name="password"
            required
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-ci-dark">Code de vérification (TOTP)</span>
          <input
            name="mfaToken"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            className="min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
            placeholder="123456"
          />
        </label>

        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-ci-dark text-white font-semibold hover:bg-ci-dark/90"
        >
          Se connecter
        </button>
      </form>

      {demoMode && (
        <div className="border border-gray-200 rounded-md p-4 text-sm">
          <p className="font-semibold text-ci-dark mb-2">
            Comptes de démonstration (code TOTP valide à l&apos;instant) :
          </p>
          <ul className="flex flex-col gap-2">
            {demoAccounts.map((account) => (
              <li key={account.id} data-testid="demo-account" data-role={account.roles[0]?.role} className="text-ci-gray">
                <strong>{ROLE_LABELS[account.roles[0]?.role ?? ""] ?? account.roles[0]?.role}</strong>
                <br />
                <span data-field="email">{account.email}</span> /{" "}
                <span data-field="password">{account.password}</span> / code :{" "}
                <span data-field="code" className="font-mono font-semibold text-ci-dark">
                  {computeTotp(account.mfaSecret)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Le code change toutes les 30 secondes — rechargez la page si la connexion échoue.
          </p>
        </div>
      )}
    </main>
  );
}
