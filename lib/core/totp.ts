import { createHmac, randomBytes } from "crypto";

/**
 * TOTP (RFC 6238) implemente directement, sans dependance externe, pour
 * le second facteur admin/agent (doc 06 §4). Phase prototype : utilise
 * en mode demonstration comme en mode Supabase, de facon identique — un
 * usage officiel evaluerait le MFA hebergé de Supabase Auth en plus de
 * ce second facteur applicatif, pas a sa place sans audit independant.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // tolere +/- 1 pas (30s) pour le decalage d'horloge

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226) — primitive sous-jacente de TOTP, exportee pour verification contre les vecteurs de test officiels. */
export function computeHotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return (binCode % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function computeTotp(secretBase32: string, atTimeMs: number = Date.now()): string {
  const counter = Math.floor(atTimeMs / 1000 / STEP_SECONDS);
  return computeHotp(secretBase32, counter);
}

export function verifyTotp(
  secretBase32: string,
  token: string,
  atTimeMs: number = Date.now()
): boolean {
  const counter = Math.floor(atTimeMs / 1000 / STEP_SECONDS);
  const normalized = token.trim();
  for (let errorWindow = -WINDOW; errorWindow <= WINDOW; errorWindow++) {
    if (computeHotp(secretBase32, counter + errorWindow) === normalized) {
      return true;
    }
  }
  return false;
}
