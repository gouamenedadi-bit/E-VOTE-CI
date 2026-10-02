import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase cote serveur avec la cle de service (doc 02 §4). Ne doit
 * JAMAIS etre importe depuis un composant client ("server-only" leve une
 * erreur de build si c'est le cas par erreur).
 */
let cachedClient: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies pour utiliser le backend Supabase."
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
