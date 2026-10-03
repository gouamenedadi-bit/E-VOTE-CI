import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Verifie la geographie reelle derriere les bureaux de vote (doc 03) :
 * creation d'un bureau via les listes region -> departement -> commune
 * en cascade, et affichage du chemin geographique complet.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

test("creation d'un bureau avec selection geographique en cascade", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "super_admin");
  await page.click('a[href="/admin/bureaux"]');

  await page.fill('input[name="code"]', "BV-GEO-1");
  await page.fill('input[name="name"]', "École Test Géo");

  // Selectionne la region "Poro" (chef-lieu Korhogo) et verifie que la
  // commune se met a jour en cascade.
  await page.selectOption('[aria-label="Région"]', { label: "Poro" });
  await expect(page.locator('select[name="communeId"]')).toHaveValue(/.+/);
  const communeLabel = await page
    .locator('select[name="communeId"] option')
    .first()
    .innerText();
  expect(communeLabel).toBe("Korhogo");

  await page.click('button:has-text("+ Ajouter")');
  await expect(page).toHaveURL(`${BASE_URL}/admin/bureaux`);
  await expect(page.getByText(/BV-GEO-1.*École Test Géo.*Korhogo \(Poro\)/)).toBeVisible();
});
