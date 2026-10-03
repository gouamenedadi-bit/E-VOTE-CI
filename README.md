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
- `lib/core/` — logique métier critique (éligibilité, jeton de vote, chiffrement du bulletin, chaîne d'intégrité, dépouillement avec réconciliation **par bureau de vote**, publication, audit), 27 tests unitaires, aucune dépendance à Next.js.
- `supabase/migrations/` — schéma PostgreSQL complet + RLS + fonction de consommation atomique du jeton (`0001_init.sql`), jeu de données de démonstration (`0002_demo_seed.sql`), simplification du rattachement des bureaux à la géographie (`0003_simplify_polling_stations.sql`).
- `lib/db/` — adaptateurs Supabase pour `lib/core`, et `lib/demo/store.ts` — magasin en mémoire qui permet de faire fonctionner tout le prototype **sans configurer Supabase** (bascule automatique selon la présence de `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, voir `lib/runtime.ts`).
- Écrans publics : accueil, présentation, résultats.
- Parcours électeur complet : connexion démo → tableau de bord → vote → confirmation → reçu (`app/connexion`, `app/espace`), avec assignation déterministe d'un bureau de vote parmi ceux rattachés au scrutin.
- Back-office administrateur (`app/admin`) : connexion (mot de passe unique simplifié — voir limite ci-dessous), tableau de bord, création de scrutin, gestion des candidats, transitions de statut (brouillon → ouvert → clôturé), **gestion des bureaux de vote** (`app/admin/bureaux`) et rattachement à un scrutin.
- Module de dépouillement (`app/admin/elections/[id]/depouillement`) : décompte des bulletins, réconciliation participations/bulletins **bureau par bureau** avec ouverture automatique d'un incident par bureau en écart, publication des résultats.
- Page publique des résultats (`app/resultats`) avec barres de pourcentage et statut provisoire/définitif selon la cohérence de la réconciliation.
- Vérifié par trois tests Playwright de bout en bout : `voter-journey.spec.ts` (vote + anti-double-vote), `admin-journey.spec.ts` (création → candidats → ouverture → vote → clôture → dépouillement → publication → affichage public), `polling-stations.spec.ts` (création et rattachement de bureaux, réconciliation par bureau).

**Limites connues de cette phase :** authentification admin simplifiée à un seul mot de passe (`lib/admin-session.ts`) — remplace Supabase Auth/MFA et le modèle de rôles multi-scopes du doc 04 (administrateur électoral limité à ses scrutins, agent limité à son bureau), à faire avant tout usage au-delà du prototype local ; pas de hiérarchie géographique réelle (région/département/commune) derrière les bureaux de vote, qui portent un nom de commune en texte libre (voir migration 0003) ; pas de journal d'audit consultable dans l'interface ni de centre de conformité ; les élections créées via le back-office rendent automatiquement tous les électeurs de démonstration éligibles, et l'affectation d'un électeur à un bureau est un simple calcul déterministe (pas un vrai fichier électoral) — simplifications documentées dans le code.

### Lancer le prototype en local

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # tests unitaires (Vitest)
npx playwright test  # parcours de bout en bout (nécessite `npm run dev` lancé à part sur le port 3100, voir playwright.config.ts)
```

Sans Supabase configuré : comptes électeur démo `0000001`/`0000002`/`0000003`, code `123456` ; back-office sur `/admin/connexion`, mot de passe `admin-demo` (ou la valeur de `ADMIN_DEMO_PASSWORD`).

Pour connecter une vraie base Supabase : copier `.env.example` en `.env.local`, renseigner les variables, puis appliquer les migrations (`supabase db push` ou via le tableau de bord Supabase).

## Prochaines étapes

- Authentification Supabase Auth/MFA et modèle de rôles multi-scopes (administrateur électoral limité à ses scrutins, agent limité à son bureau) pour remplacer l'authentification admin simplifiée actuelle.
- Géographie réelle (régions/départements/communes/circonscriptions) derrière les bureaux de vote.
- Journal d'audit consultable et centre de conformité dans l'interface admin.
- Tests d'acceptation formalisés, test de charge et de pénétration (doc 06 §7).

Le code est construit par étapes, module par module, avec tests, conformément à la règle du cahier des charges : ne pas générer l'ensemble du code en un seul bloc.
