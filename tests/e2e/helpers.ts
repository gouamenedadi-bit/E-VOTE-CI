import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Se connecte au back-office avec un des comptes de demonstration
 * (doc 04). Lit email/mot de passe/code TOTP directement sur la page
 * /admin/connexion (affiches en mode demonstration uniquement, voir
 * app/admin/connexion/page.tsx) plutot que de dupliquer les secrets ici.
 */
export async function loginAsAdmin(
  page: Page,
  baseUrl: string,
  role: "super_admin" | "election_admin" | "station_agent" | "observer"
): Promise<void> {
  await page.goto(`${baseUrl}/admin/connexion`);

  const row = page.locator(`[data-testid="demo-account"][data-role="${role}"]`);
  const email = await row.locator('[data-field="email"]').innerText();
  const password = await row.locator('[data-field="password"]').innerText();
  const code = await row.locator('[data-field="code"]').innerText();

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="mfaToken"]', code);
  await page.click('button[type="submit"]');
}
