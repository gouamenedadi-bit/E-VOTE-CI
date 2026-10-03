import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Verifie l'application des roles et des perimetres (doc 04) : un
 * administrateur electoral ne peut gerer que son scrutin attribue, un
 * agent de bureau est redirige vers son propre bureau, un observateur
 * voit tout en lecture seule. Ces controles sont deja testes au niveau
 * unitaire (tests/unit/authorization.test.ts) — ce test verifie qu'ils
 * sont reellement appliques par les pages/actions, pas seulement par la
 * logique pure.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

async function logout(page: import("@playwright/test").Page) {
  await page.click('button:has-text("Déconnexion")');
  await expect(page).toHaveURL(`${BASE_URL}/`);
}

test("un administrateur electoral ne peut pas gerer un scrutin hors de son perimetre", async ({
  page,
}) => {
  // 1. Le super admin cree un second scrutin, hors du perimetre de
  // l'administrateur electoral de demonstration (qui n'a que la
  // presidentielle seedee).
  await loginAsAdmin(page, BASE_URL, "super_admin");
  await expect(page).toHaveURL(`${BASE_URL}/admin`);

  await page.click('a[href="/admin/elections/nouveau"]');
  await page.selectOption('select[name="electionTypeId"]', { index: 3 }); // Régionales
  await page.fill('input[name="name"]', "Régionales — Hors Périmètre");
  const now = new Date();
  const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
  await page.fill('input[name="startsAt"]', toLocalInput(new Date(now.getTime() - 60 * 60 * 1000)));
  await page.fill('input[name="endsAt"]', toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
  await page.click('button:has-text("Créer le scrutin")');
  await expect(page.getByRole("heading", { name: "Régionales — Hors Périmètre" })).toBeVisible();
  const foreignElectionUrl = page.url();

  await page.goto(`${BASE_URL}/admin`);
  await logout(page);

  // 2. L'administrateur electoral (scope : presidentielle) se connecte.
  await loginAsAdmin(page, BASE_URL, "election_admin");
  await expect(page).toHaveURL(`${BASE_URL}/admin`);

  // Ne voit que son scrutin attribue, pas le nouveau.
  await expect(page.getByText("Présidentielle — Simulation")).toBeVisible();
  await expect(page.getByText("Régionales — Hors Périmètre")).not.toBeVisible();

  // Ne peut pas creer de nouveau scrutin (reserve au super admin).
  await expect(page.locator('a[href="/admin/elections/nouveau"]')).not.toBeVisible();

  // 3. Tentative directe sur le scrutin hors perimetre : refusee.
  await page.goto(foreignElectionUrl);
  await expect(page).toHaveURL(`${BASE_URL}/admin?erreur=forbidden`);
  await expect(page.getByText("Action non autorisée")).toBeVisible();

  // 4. Son propre scrutin reste gerable.
  await page.goto(`${BASE_URL}/admin/elections/demo-election-presidentielle`);
  await expect(page.getByRole("heading", { name: "Présidentielle — Simulation" })).toBeVisible();
});

test("un agent de bureau est redirige vers son propre bureau", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "station_agent");
  await expect(page).toHaveURL(`${BASE_URL}/admin/mon-bureau`);
  await expect(page.getByText("BV-001")).toBeVisible();
});

test("un observateur voit tous les scrutins en lecture seule", async ({ page }) => {
  await loginAsAdmin(page, BASE_URL, "observer");
  await expect(page).toHaveURL(`${BASE_URL}/admin`);

  await expect(page.getByText("Présidentielle — Simulation")).toBeVisible();
  await expect(page.locator('a[href="/admin/elections/nouveau"]')).not.toBeVisible();
  await expect(page.getByText("Lecture seule").first()).toBeVisible();
});
