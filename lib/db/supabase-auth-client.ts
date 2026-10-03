import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase Auth cote serveur, lie aux cookies de la requete — a
 * distinguer de lib/db/supabase-server.ts (cle de service, hors RLS,
 * pour les operations critiques de /lib/core). Celui-ci utilise la cle
 * anonyme et respecte les politiques RLS de l'utilisateur authentifie
 * (doc 02 §4) : c'est le chemin normal pour l'authentification et pour
 * lire ses propres roles (`user_sees_own_roles`, migration 0001).
 *
 * NON VERIFIE EN DIRECT : necessite un projet Supabase reel. Ecrit selon
 * la documentation officielle @supabase/ssr (pattern getAll/setAll pour
 * App Router).
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent etre definies pour l'authentification Supabase."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appele depuis un contexte qui ne peut pas muter les cookies
          // (ex. rendu d'un composant serveur hors Server Action) — sans
          // consequence, la session sera rafraichie au prochain appel
          // depuis une Server Action ou un Route Handler.
        }
      },
    },
  });
}
