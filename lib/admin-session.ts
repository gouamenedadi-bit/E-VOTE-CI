import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "evote_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 4; // 4 heures

/**
 * Authentification administrateur SIMPLIFIEE pour cette phase du prototype :
 * un seul compte, verifie contre ADMIN_DEMO_PASSWORD (ou une valeur de
 * developpement par defaut, avec avertissement). Le modele complet
 * (Supabase Auth + MFA, roles multiples scopes par scrutin/bureau — doc
 * 04) reste a implementer ; voir docs/04-roles-et-permissions.md. Ne pas
 * utiliser cette authentification pour un usage reel.
 */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_DEMO_PASSWORD;
  if (!expected) {
    console.warn(
      "[E-VOTE CI] ADMIN_DEMO_PASSWORD absente — mot de passe de developpement " +
        "'admin-demo' utilise. A definir avant tout usage partage."
    );
  }
  return password === (expected ?? "admin-demo");
}

export async function setAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "super_admin", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "super_admin";
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/connexion");
  }
}
