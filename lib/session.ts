import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "evote_demo_voter";
const MAX_AGE_SECONDS = 60 * 60; // 1 heure, session de demonstration courte

/**
 * Session electeur de demonstration : ne contient que l'identifiant du
 * compte demo, jamais un jeton de vote (le jeton reste entierement
 * interne au Server Action qui emet puis consomme, doc 02 §3.1).
 */
export async function setVoterSession(voterId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getVoterSession(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearVoterSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
