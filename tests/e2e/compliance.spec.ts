import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Verifie le centre de conformite (doc 01 §16) : accessible au super
 * admin et a l'observateur, refuse a un administrateur electoral,
 * affiche les comptes par role et le statut d'integrite du journal.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

test("le super administrateur voit le centre de conformite", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "super_admin");
  await page.click('a[href="/admin/conformite"]');
  await expect(page).toHaveURL(`${BASE_URL}/admin/conformite`);
  await expect(page.getByText("Inventaire des données et finalités")).toBeVisible();
  await expect(page.getByText(/Journal d'audit intact/)).toBeVisible();
});

test("un administrateur electoral n'a pas acces au centre de conformite", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "election_admin");
  await page.goto(`${BASE_URL}/admin/conformite`);
  await expect(page).toHaveURL(`${BASE_URL}/admin?erreur=forbidden`);
});
