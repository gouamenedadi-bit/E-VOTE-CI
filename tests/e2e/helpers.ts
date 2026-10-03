import type { Page } from "@playwright/test";

/**
 * Se connecte au back-office avec un des comptes de demonstration (doc
 * 04), via le bouton de connexion rapide affiche en mode demonstration
 * (voir app/admin/connexion/page.tsx) — un mini-formulaire avec des
 * champs caches deja remplis cote serveur, pour eliminer tout risque de
 * faute de frappe en recopiant email/mot de passe/code a la main.
 */
export async function loginAsAdmin(
  page: Page,
  baseUrl: string,
  role: "super_admin" | "election_admin" | "station_agent" | "observer"
): Promise<void> {
  await page.goto(`${baseUrl}/admin/connexion`);

  const row = page.locator(`[data-testid="demo-account"][data-role="${role}"]`);
  await row.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/connexion"));
}
