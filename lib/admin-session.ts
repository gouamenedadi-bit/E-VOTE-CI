import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RoleAssignment } from "./core/authorization";
import { verifyTotp } from "./core/totp";
import { isSupabaseConfigured, getServiceRoleClient } from "./db/supabase-server";
import * as demo from "./demo/store";

const COOKIE_NAME = "evote_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 4; // 4 heures

export interface AdminSession {
  accountId: string;
  email: string;
  fullName: string;
  roles: RoleAssignment[];
}

export type AdminLoginResult =
  | { ok: true; accountId: string }
  | { ok: false; reason: "invalid_credentials" | "invalid_mfa" };

/**
 * Authentification admin/agent/observateur a deux facteurs (doc 04, doc
 * 06 §4). En mode demonstration : comptes et secret TOTP geres par
 * lib/demo/store.ts (lib/core/totp.ts, implementation RFC 6238 verifiee
 * contre les vecteurs officiels). En mode Supabase : delegue a Supabase
 * Auth + son API MFA — NON VERIFIE EN DIRECT, necessite un projet reel
 * avec des facteurs TOTP deja enroles pour chaque compte (hors perimetre
 * de ce prototype, voir lib/db/supabase-auth-client.ts).
 */
export async function authenticateAdmin(
  email: string,
  password: string,
  mfaToken: string
): Promise<AdminLoginResult> {
  if (!isSupabaseConfigured()) {
    const account = demo.findAdminAccountByEmail(email);
    if (!account || account.password !== password) {
      return { ok: false, reason: "invalid_credentials" };
    }
    if (!verifyTotp(account.mfaSecret, mfaToken)) {
      return { ok: false, reason: "invalid_mfa" };
    }
    return { ok: true, accountId: account.id };
  }

  const { createServerAuthClient } = await import("./db/supabase-auth-client");
  const client = await createServerAuthClient();

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.session || !signInData.user) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const { data: factorsData, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  const totpFactor = factorsData?.totp?.[0];
  if (!totpFactor) {
    await client.auth.signOut();
    return { ok: false, reason: "invalid_mfa" };
  }

  const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({
    factorId: totpFactor.id,
  });
  if (challengeError) throw challengeError;

  const { data: verifyData, error: verifyError } = await client.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challengeData.id,
    code: mfaToken,
  });
  if (verifyError || !verifyData) {
    return { ok: false, reason: "invalid_mfa" };
  }

  return { ok: true, accountId: signInData.user.id };
}

export async function setAdminSession(accountId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  if (isSupabaseConfigured()) {
    const { createServerAuthClient } = await import("./db/supabase-auth-client");
    const client = await createServerAuthClient();
    await client.auth.signOut();
  }
}

/**
 * Relit les roles depuis la base a chaque appel (pas de cache de
 * session) — une revocation de role prend effet immediatement, sans
 * attendre l'expiration du cookie (doc 04 §4).
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const accountId = store.get(COOKIE_NAME)?.value;
  if (!accountId) return null;

  if (!isSupabaseConfigured()) {
    const account = demo.getAdminAccount(accountId);
    if (!account) return null;
    return {
      accountId: account.id,
      email: account.email,
      fullName: account.fullName,
      roles: account.roles,
    };
  }

  const client = getServiceRoleClient();
  const { data: userRow, error: userError } = await client
    .from("users")
    .select("id, email, full_name")
    .eq("id", accountId)
    .maybeSingle();
  if (userError) throw userError;
  if (!userRow) return null;

  const { data: roleRows, error: roleError } = await client
    .from("user_roles")
    .select("scope_election_id, scope_polling_station_id, roles(code)")
    .eq("user_id", accountId);
  if (roleError) throw roleError;

  const roles: RoleAssignment[] = (roleRows ?? []).map((row) => {
    const roleInfo = row.roles as unknown as { code: string } | { code: string }[] | null;
    const code = (Array.isArray(roleInfo) ? roleInfo[0]?.code : roleInfo?.code) as RoleAssignment["role"];
    return {
      role: code,
      scopeElectionId: row.scope_election_id,
      scopePollingStationId: row.scope_polling_station_id,
    };
  });

  return { accountId: userRow.id, email: userRow.email, fullName: userRow.full_name, roles };
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/connexion");
  }
  return session;
}
