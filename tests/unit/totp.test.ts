import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  computeHotp,
  computeTotp,
  generateTotpSecret,
  verifyTotp,
} from "../../lib/core/totp";

describe("base32Encode/base32Decode", () => {
  it("fait un aller-retour fidele", () => {
    const original = Buffer.from("12345678901234567890", "ascii");
    const encoded = base32Encode(original);
    const decoded = base32Decode(encoded);
    expect(decoded.subarray(0, original.length).equals(original)).toBe(true);
  });
});

describe("computeHotp — vecteurs de test officiels RFC 4226 Appendix D", () => {
  // Secret ASCII "12345678901234567890", 6 chiffres, HMAC-SHA1.
  const secretBase32 = base32Encode(Buffer.from("12345678901234567890", "ascii"));
  const expected = [
    "755224",
    "287082",
    "359152",
    "969429",
    "338314",
    "254676",
    "287922",
    "162583",
    "399871",
    "520489",
  ];

  it.each(expected.map((value, counter) => [counter, value] as const))(
    "counter=%i -> %s",
    (counter, value) => {
      expect(computeHotp(secretBase32, counter)).toBe(value);
    }
  );
});

describe("computeTotp / verifyTotp", () => {
  it("verifie un code valide genere pour l'instant present", () => {
    const secret = generateTotpSecret();
    const token = computeTotp(secret);
    expect(verifyTotp(secret, token)).toBe(true);
  });

  it("rejette un code incorrect", () => {
    const secret = generateTotpSecret();
    const token = computeTotp(secret);
    const wrong = token === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it("tolere un decalage de 4 periodes (120s, pour la saisie manuelle en mode demo) mais pas cinq", () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const token = computeTotp(secret, now);

    expect(verifyTotp(secret, token, now + 120_000)).toBe(true);
    expect(verifyTotp(secret, token, now - 120_000)).toBe(true);
    expect(verifyTotp(secret, token, now + 150_000)).toBe(false);
  });

  it("deux secrets differents produisent des codes differents (sauf collision improbable)", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    expect(secretA).not.toBe(secretB);
  });
});
