import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "crypto";
import { computeRecordHash } from "./integrity";
import { consumeVotingToken } from "./voting-token";
import type { BallotRepository, Clock, CredentialRepository, MasterKeyProvider } from "./ports";
import type { BallotChoice, EncryptedBallot } from "./types";

const ALGO = "aes-256-gcm";

interface EnvelopeCiphertext {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  wrappedDataKey: Buffer;
}

/**
 * Chiffrement enveloppe (doc 02 §3.4) : cle de donnees aleatoire par
 * bulletin, elle-meme chiffree par la cle maitresse serveur. Protege la
 * confidentialite au repos ; ne constitue pas un protocole de vote
 * verifiable de bout en bout (hors perimetre de la phase simulation).
 */
export function encryptBallotPayload(
  choice: BallotChoice,
  masterKeyProvider: MasterKeyProvider
): EnvelopeCiphertext {
  const plaintext = Buffer.from(JSON.stringify(choice), "utf8");
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);

  const cipher = createCipheriv(ALGO, dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const masterKey = masterKeyProvider.getKey(masterKeyProvider.currentKeyId());
  const wrapIv = randomBytes(12);
  const wrapCipher = createCipheriv(ALGO, masterKey, wrapIv);
  const wrappedData = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
  const wrapAuthTag = wrapCipher.getAuthTag();

  return {
    ciphertext,
    iv,
    authTag,
    wrappedDataKey: Buffer.concat([wrapIv, wrapAuthTag, wrappedData]),
  };
}

export function decryptBallotPayload(
  ballot: Pick<EncryptedBallot, "ciphertext" | "iv" | "authTag" | "wrappedDataKey">,
  masterKeyProvider: MasterKeyProvider,
  keyId: string
): BallotChoice {
  const masterKey = masterKeyProvider.getKey(keyId);
  const wrapIv = ballot.wrappedDataKey.subarray(0, 12);
  const wrapAuthTag = ballot.wrappedDataKey.subarray(12, 28);
  const wrappedData = ballot.wrappedDataKey.subarray(28);

  const unwrapCipher = createDecipheriv(ALGO, masterKey, wrapIv);
  unwrapCipher.setAuthTag(wrapAuthTag);
  const dataKey = Buffer.concat([unwrapCipher.update(wrappedData), unwrapCipher.final()]);

  const decipher = createDecipheriv(ALGO, dataKey, ballot.iv);
  decipher.setAuthTag(ballot.authTag);
  const plaintext = Buffer.concat([decipher.update(ballot.ciphertext), decipher.final()]);

  return JSON.parse(plaintext.toString("utf8")) as BallotChoice;
}

export type DepositBallotOutcome =
  | { ok: true; duplicate: false }
  | { ok: true; duplicate: true }
  | { ok: false; reason: "invalid_token" };

/**
 * Depot du bulletin. Ne recoit jamais l'identite de l'electeur, seulement
 * le jeton : encrypted_ballots ne stocke ni demoVoterId ni credentialId
 * (doc 03 §5). La consommation du jeton et l'insertion du bulletin sont
 * traitees comme une seule unite logique ; en cas de nouvel essai apres
 * un jeton deja consomme, aucun second bulletin n'est cree (idempotence,
 * doc 05 §1 - reprise de session).
 */
export async function depositBallot(
  params: { rawToken: string; electionId: string; choice: BallotChoice; pollingStationId?: string | null },
  deps: {
    credentialRepo: CredentialRepository;
    ballotRepo: BallotRepository;
    masterKeyProvider: MasterKeyProvider;
    clock: Clock;
  }
): Promise<DepositBallotOutcome> {
  const consumed = await consumeVotingToken(params.rawToken, params.electionId, {
    credentialRepo: deps.credentialRepo,
    clock: deps.clock,
  });

  if (!consumed.ok) {
    if (consumed.reason === "already_consumed") {
      return { ok: true, duplicate: true };
    }
    return { ok: false, reason: "invalid_token" };
  }

  const envelope = encryptBallotPayload(params.choice, deps.masterKeyProvider);
  const prevHash = await deps.ballotRepo.getLastIntegrityHash(params.electionId);

  const content = {
    electionId: params.electionId,
    ciphertext: envelope.ciphertext.toString("hex"),
  };
  const recordHash = computeRecordHash(content, prevHash);

  const ballot: EncryptedBallot = {
    id: randomUUID(),
    electionId: params.electionId,
    pollingStationId: params.pollingStationId ?? null,
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    authTag: envelope.authTag,
    wrappedDataKey: envelope.wrappedDataKey,
    encryptionKeyId: deps.masterKeyProvider.currentKeyId(),
    integrityPrevHash: prevHash,
    integrityRecordHash: recordHash,
    recordedAt: deps.clock.now(),
  };

  await deps.ballotRepo.insert(ballot);

  return { ok: true, duplicate: false };
}
