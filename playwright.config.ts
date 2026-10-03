import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Serie, pas en parallele : les tests partagent le meme magasin de
  // demonstration en memoire (process unique du serveur de dev).
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3100",
  },
  reporter: [["list"]],
});
