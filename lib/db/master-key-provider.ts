import { createHash } from "crypto";
import type { MasterKeyProvider } from "../core/ports";

const DEV_FALLBACK_KEY_ID = "dev-fallback-key";

/**
 * Cle maitresse cote serveur uniquement (doc 02 §4). En l'absence de
 * BALLOT_MASTER_KEY (ex. environnement local sans Supabase configure),
 * utilise une cle deterministe DEV UNIQUEMENT — jamais valable pour un
 * environnement partage ou une donnee reelle.
 */
export function createMasterKeyProvider(): MasterKeyProvider {
  const envKey = process.env.BALLOT_MASTER_KEY;

  if (!envKey) {
    console.warn(
      "[E-VOTE CI] BALLOT_MASTER_KEY absente — cle de developpement non securisee utilisee. " +
        "A definir avant tout usage partage (doc 02 §4)."
    );
    const devKey = createHash("sha256").update("e-vote-ci-dev-only-never-use-in-shared-env").digest();
    return {
      getKey: () => devKey,
      currentKeyId: () => DEV_FALLBACK_KEY_ID,
    };
  }

  const key = Buffer.from(envKey, "base64");
  if (key.length !== 32) {
    throw new Error("BALLOT_MASTER_KEY doit decoder en 32 octets (AES-256) en base64");
  }

  return {
    getKey: () => key,
    currentKeyId: () => "env-key-1",
  };
}
