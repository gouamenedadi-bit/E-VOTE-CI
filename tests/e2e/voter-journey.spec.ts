import { test, expect } from "@playwright/test";

/**
 * Parcours electeur complet (doc 05 §1) contre le magasin de
 * demonstration en memoire. Necessite `next dev` ou `next start` lance
 * sur BASE_URL (par defaut http://localhost:3100).
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

test("identification, vote et reçu", async ({ page }) => {
  await page.goto(`${BASE_URL}/connexion`);
  await page.fill('input[name="voterNumber"]', "0000002");
  await page.fill('input[name="verificationCode"]', "123456");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(`${BASE_URL}/espace`);
  await expect(page.getByText("Présidentielle — Simulation")).toBeVisible();

  await page.click('a[href="/espace/demo-election-presidentielle"]');
  await expect(page).toHaveURL(`${BASE_URL}/espace/demo-election-presidentielle`);

  await page
    .locator(".ci-card", { hasText: "Candidat A" })
    .getByRole("button", { name: "Voter" })
    .click();

  await expect(page.getByText("N°1 — Candidat A")).toBeVisible();
  await page.click('button:has-text("Confirmer le vote")');

  await expect(page).toHaveURL(`${BASE_URL}/espace/demo-election-presidentielle/recu`);
  await expect(page.getByRole("heading", { name: "Participation enregistrée" })).toBeVisible();

  // Reprise : revisiter l'ecran de vote apres avoir deja vote doit
  // rediriger vers le recu, jamais permettre un second vote.
  await page.goto(`${BASE_URL}/espace/demo-election-presidentielle`);
  await expect(page).toHaveURL(`${BASE_URL}/espace/demo-election-presidentielle/recu`);
});
