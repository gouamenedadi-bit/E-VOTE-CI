# E-VOTE CI (nom provisoire)

Plateforme de **démonstration et de simulation** de vote électronique pour des scrutins ivoiriens (présidentielle, législatives, municipales, régionales, sénatoriales).

> **Statut : simulation uniquement.** Aucune donnée réelle d'électeur, aucun accès au fichier électoral officiel, aucune valeur juridique des résultats produits. Voir [docs/01-cahier-des-charges-fonctionnel.md](docs/01-cahier-des-charges-fonctionnel.md) §1 pour les conditions à réunir avant tout usage officiel.

## Documentation de conception

| Document | Contenu |
|---|---|
| [01 — Cahier des charges fonctionnel](docs/01-cahier-des-charges-fonctionnel.md) | Périmètre, fonctionnalités, exigences non fonctionnelles, hors périmètre |
| [02 — Architecture technique](docs/02-architecture-technique.md) | Stack, séparation identité/bulletin, chiffrement, secrets, déploiement |
| [03 — Schéma de base de données](docs/03-schema-base-de-donnees.md) | Tables PostgreSQL, contraintes, index, principes RLS |
| [04 — Rôles et permissions](docs/04-roles-et-permissions.md) | Matrice de permissions par rôle, traduction en RLS |
| [05 — Parcours utilisateurs](docs/05-parcours-utilisateurs.md) | Parcours électeur, admin, agent, dépouillement, publication, cas limites |
| [06 — Plan de sécurité détaillé](docs/06-plan-de-securite.md) | Modèle de menaces, chaînage de hachage (intégrité), tests de sécurité obligatoires |
| [07 — Maquettes des écrans](docs/07-maquettes-ecrans.md) | Wireframes texte de chaque écran, dans l'ordre de construction |

### Décision retenue sur l'intégrité des données sensibles

Phase prototype : chaînage de hachage append-only (type Merkle/blockchain légère) sur `audit_events`, `tally_records` et les métadonnées de `encrypted_ballots`, avec ancrage périodique hors base (doc 06 §3). Une vraie blockchain distribuée multi-parties (CEI, partis, observateurs) est documentée comme évolution possible pour un futur usage officiel, pas implémentée maintenant — décision prise le 2026-10-03.

## État du code (prototype)

Stack : Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4, Vitest pour les tests unitaires, Playwright pour les parcours de bout en bout.

**Construit et testé :**
- `lib/core/` — logique métier critique (éligibilité, jeton de vote, chiffrement du bulletin, chaîne d'intégrité, dépouillement, audit), 20 tests unitaires, aucune dépendance à Next.js.
- `supabase/migrations/` — schéma PostgreSQL complet + RLS + fonction de consommation atomique du jeton (`0001_init.sql`), jeu de données de démonstration (`0002_demo_seed.sql`).
- `lib/db/` — adaptateurs Supabase pour `lib/core`, et `lib/demo/store.ts` — magasin en mémoire qui permet de faire fonctionner tout le parcours électeur **sans configurer Supabase** (bascule automatique selon la présence de `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, voir `lib/runtime.ts`).
- Écrans publics : accueil, présentation.
- Parcours électeur complet : connexion démo → tableau de bord → vote → confirmation → reçu (`app/connexion`, `app/espace`). Vérifié par un test Playwright (`tests/e2e/voter-journey.spec.ts`) couvrant aussi la reprise après un vote déjà effectué.

**Pas encore construit :** back-office (élections, candidats, bureaux), module de dépouillement/résultats publics, journal d'audit consultable, centre de conformité, authentification Supabase Auth/MFA pour les rôles admin/agent/observateur.

### Lancer le prototype en local

```bash
npm install
npm run dev        # http://localhost:3000, sans Supabase : comptes démo 0000001/0000002/0000003, code 123456
npm test           # tests unitaires (Vitest)
npx playwright test  # parcours électeur de bout en bout (nécessite `npm run dev` lancé à part)
```

Pour connecter une vraie base Supabase : copier `.env.example` en `.env.local`, renseigner les variables, puis appliquer les migrations (`supabase db push` ou via le tableau de bord Supabase).

## Prochaines étapes

- Back-office administrateur (élections, candidats, bureaux de vote).
- Module de dépouillement + page publique des résultats + journal d'audit consultable.
- Authentification Supabase Auth/MFA pour les rôles non-électeur et RLS correspondante.
- Tests d'acceptation formalisés, test de charge et de pénétration (doc 06 §7).

Le code est construit par étapes, module par module, avec tests, conformément à la règle du cahier des charges : ne pas générer l'ensemble du code en un seul bloc.
