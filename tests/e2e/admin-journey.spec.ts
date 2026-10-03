import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Parcours back-office complet (doc 05 §2 et §4) : creation d'un scrutin,
 * ajout de candidats, ouverture, vote d'un electeur demo, cloture,
 * depouillement, publication, puis verification sur la page publique.
 * Necessite `next dev` lance sur BASE_URL en mode demonstration (sans
 * Supabase configure).
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

test("creation, vote, depouillement et publication d'un scrutin", async ({ page }) => {
  // 1. Connexion admin (super_admin — seul role autorise a creer un scrutin)
  await loginAsAdmin(page, BASE_URL, "super_admin");
  await expect(page).toHaveURL(`${BASE_URL}/admin`);

  // 2. Creation du scrutin
  await page.click('a[href="/admin/elections/nouveau"]');
  await page.selectOption('select[name="electionTypeId"]', { index: 1 }); // Législatives
  await page.fill('input[name="name"]', "Législatives — Test E2E");
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
  await page.fill('input[name="startsAt"]', toLocalInput(start));
  await page.fill('input[name="endsAt"]', toLocalInput(end));
  await page.click('button:has-text("Créer le scrutin")');

  await expect(page.getByRole("heading", { name: "Législatives — Test E2E" })).toBeVisible();
  const electionUrl = page.url();

  // 3. Ajout de deux candidats
  await page.fill('input[name="displayName"]', "Candidate Test X");
  await page.fill('input[name="partyName"]', "Parti X");
  await page.click('button:has-text("+ Ajouter")');
  await expect(page.getByText("N°1 — Candidate Test X — Parti X")).toBeVisible();

  await page.fill('input[name="displayName"]', "Candidate Test Y");
  await page.click('button:has-text("+ Ajouter")');
  await expect(page.getByText("N°2 — Candidate Test Y")).toBeVisible();

  // 4. Ouverture du scrutin
  await page.click('button:has-text("Ouvrir le scrutin")');
  await expect(page.getByText(/Ouvert/)).toBeVisible();

  const electionId = electionUrl.split("/").pop();

  // 5. Vote d'un electeur de demonstration sur ce nouveau scrutin
  await page.goto(`${BASE_URL}/connexion`);
  await page.fill('input[name="voterNumber"]', "0000003");
  await page.fill('input[name="verificationCode"]', "123456");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE_URL}/espace`);

  await page.goto(`${BASE_URL}/espace/${electionId}`);
  await page.click('input[name="candidate"][value*="-"]'); // premier candidat reel
  await page.click('button:has-text("Continuer")');
  await page.click('button:has-text("Confirmer le vote")');
  await expect(page).toHaveURL(`${BASE_URL}/espace/${electionId}/recu`);

  // 6. Retour admin : cloture du scrutin
  await loginAsAdmin(page, BASE_URL, "super_admin");
  await expect(page).toHaveURL(`${BASE_URL}/admin`);
  await page.goto(`${electionUrl}`);
  await page.click('button:has-text("Clôturer le scrutin")');
  await expect(page.getByText(/Clôturé/)).toBeVisible();

  // 7. Depouillement
  await page.click('a:has-text("Module de dépouillement")');
  await page.click('button:has-text("Lancer le dépouillement")');
  await expect(page.getByText(/1 participation/)).toBeVisible();
  await expect(page.getByText("✓ Cohérent")).toBeVisible();

  // 8. Publication
  await page.click('button:has-text("Publier les résultats")');
  await expect(page.getByText(/Résultats publiés le/)).toBeVisible();

  // 9. Verification sur la page publique
  await page.goto(`${BASE_URL}/resultats`);
  await expect(page.getByRole("heading", { name: "Législatives — Test E2E" })).toBeVisible();
  await expect(page.getByText("DÉFINITIF")).toBeVisible();
});
