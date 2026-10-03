import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Verifie le journal d'audit (doc 05 §6, doc 06 §3) : visible et
 * coherent pour le super admin et l'observateur, refuse a un
 * administrateur electoral (doc 04 — pas autorise a consulter le
 * journal complet).
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

test("le super administrateur voit un journal d'audit coherent apres une action", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "super_admin");

  // Genere au moins un evenement d'audit.
  await page.click('a[href="/admin/elections/nouveau"]');
  await page.selectOption('select[name="electionTypeId"]', { index: 2 });
  await page.fill('input[name="name"]', "Municipales — Test Audit");
  const now = new Date();
  const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
  await page.fill('input[name="startsAt"]', toLocalInput(new Date(now.getTime() - 60 * 60 * 1000)));
  await page.fill('input[name="endsAt"]', toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
  await page.click('button:has-text("Créer le scrutin")');
  await expect(page.getByRole("heading", { name: "Municipales — Test Audit" })).toBeVisible();

  await page.goto(`${BASE_URL}/admin/audit`);
  await expect(page.getByText(/Chaîne d'intégrité vérifiée/)).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Création du scrutin" }).first()).toBeVisible();
});

test("un administrateur electoral n'a pas acces au journal d'audit", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "election_admin");
  await page.goto(`${BASE_URL}/admin/audit`);
  await expect(page).toHaveURL(`${BASE_URL}/admin?erreur=forbidden`);
});

test("l'observateur peut consulter le journal d'audit", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "observer");
  await page.click('a[href="/admin/audit"]');
  await expect(page).toHaveURL(`${BASE_URL}/admin/audit`);
  await expect(page.getByText(/Chaîne d'intégrité vérifiée|Altération détectée/)).toBeVisible();
});
