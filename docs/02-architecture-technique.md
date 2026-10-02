# Architecture technique — E-VOTE CI

## 1. Vue d'ensemble

```
┌──────────────────────────────┐
│          Navigateur           │   Next.js (App Router) + React + TS
│  (aucune clé secrète ici)     │   Tailwind CSS, composants accessibles
└──────────────┬────────────────┘
               │ HTTPS
┌──────────────▼────────────────┐
│   Next.js Server (Vercel)     │
│  - Route Handlers / Server    │
│    Actions = API métier       │
│  - Validation Zod systématique│
│  - Service layer isolé        │  ← logique critique testable sans HTTP
│    (eligibility, token,       │
│     ballot, tally)            │
└──────────────┬────────────────┘
               │ (service role key, jamais exposée au client)
┌──────────────▼────────────────┐
│          Supabase             │
│  - PostgreSQL (RLS activé)    │
│  - Auth (admin/agent, MFA)    │
│  - Storage (documents publics)│
└────────────────────────────────┘
```

Principe directeur : **le navigateur n'a jamais accès direct à la base**. Toute écriture critique (émission de jeton, dépôt de bulletin, dépouillement) passe par une Server Action / Route Handler qui s'exécute côté serveur avec la clé de service, après validation Zod et vérification d'autorisation. Le client authentifié par Supabase Auth (pour les rôles admin/agent/observateur) ne reçoit que des droits RLS correspondant à son rôle ; il n'utilise jamais la clé de service.

## 2. Organisation du code

```
/app                      → routes Next.js (App Router), par rôle
  /(public)                → accueil, présentation, résultats publics
  /(voter)                 → espace électeur de démonstration
  /(admin)                 → back-office (super admin, admin électoral)
  /(station)               → interface agent de bureau
/lib
  /core                    → logique métier pure, sans dépendance Next/HTTP
    eligibility.ts          → vérifie l'éligibilité, ne connaît pas le bulletin
    voting-token.ts         → émission/consommation atomique du jeton
    ballot.ts               → chiffrement, dépôt, intégrité du bulletin
    tally.ts                → décompte, réconciliation, détection d'anomalies
    audit.ts                → écriture dans le journal d'audit (append-only)
  /db                      → client Supabase (serveur / navigateur), jamais mélangés
  /validation              → schémas Zod partagés
/tests
  /unit                    → Vitest sur /lib/core, sans base réelle (ou test DB dédiée)
  /e2e                     → Playwright sur les parcours complets
```

`/lib/core` ne doit importer ni `next/server`, ni les secrets d'environnement du navigateur : c'est la condition pour pouvoir le tester "indépendamment du frontend" (exigence du cahier des charges, §3).

## 3. Séparation identité / bulletin (secret du vote)

C'est la décision d'architecture centrale du projet. Le flux est volontairement découpé en deux services qui n'ont jamais de clé étrangère l'un vers l'autre :

### 3.1 Service d'éligibilité et de jeton
1. L'électeur (de démonstration) s'identifie (numéro fictif + second facteur du scénario).
2. Le serveur vérifie `voter_eligibility` (scrutin, circonscription) → si éligible et pas déjà voté, génère un **jeton de vote** : UUID aléatoire opaque, signé/scellé côté serveur, avec une durée de validité courte.
3. Le jeton est inscrit dans `voting_credentials` avec son statut (`issued`), **sans** le choix, et avec l'identifiant électeur côté identification uniquement dans cette table-là.
4. Une fois le jeton émis, la table `participation_records` enregistre la participation (scrutin, bureau, horodatage) — c'est la seule trace que « quelqu'un a voté », sans lien vers le bulletin.

### 3.2 Service de bulletin
1. Le navigateur présente uniquement le **jeton** (pas l'identité) pour déposer un bulletin.
2. Le serveur vérifie, dans une transaction atomique : jeton existe, statut `issued`, non expiré, correspond au scrutin → sinon rejet idempotent (y compris en cas de double soumission réseau).
3. Le bulletin est chiffré (voir §3.4) et inséré dans `encrypted_ballots` avec un identifiant aléatoire **indépendant** du jeton et de l'électeur, puis le jeton passe à `consumed` dans la même transaction.
4. Aucune colonne, aucune vue, aucun log ne doit permettre de faire le lien `voting_credentials.voter_id → encrypted_ballots.id`. Ceci est vérifié par un test automatisé dédié (doc 01 §... / voir plan de tests).

### 3.3 Pourquoi deux tables et pas une avec des colonnes nullable
Une table unique crée un risque structurel : un bug, une migration ou un accès admin mal restreint suffirait à relier identité et choix. Deux stores physiquement séparés (et si possible, à terme, deux schémas Postgres avec des politiques RLS et des rôles de connexion distincts) rendent cette reconstitution impossible par construction, pas seulement par convention applicative.

### 3.4 Chiffrement — ce que fait la phase simulation, ce qu'elle ne fait pas
- **Phase simulation** : chiffrement enveloppe du contenu du bulletin (AES-256-GCM avec une clé de données générée par bulletin, elle-même chiffrée par une clé maîtresse détenue côté serveur / gestionnaire de secrets Vercel/Supabase). Cela protège la confidentialité au repos et en cas de fuite de la base, mais **ne constitue pas** un protocole de vote vérifiable de bout en bout.
- **Hors périmètre simulation, requis pour un usage officiel** : un protocole académique audité (ex. familles de schémas à chiffrement homomorphe/mix-nets avec preuves à divulgation nulle de connaissance) conçu et validé par une expertise cryptographique indépendante. Le projet ne doit pas inventer son propre protocole pour un usage réel — ce point est documenté comme risque résiduel explicite, pas comme un TODO silencieux.

## 4. Gestion des secrets

- `SUPABASE_SERVICE_ROLE_KEY`, clés de chiffrement : variables d'environnement serveur uniquement (Vercel Project Settings), jamais préfixées `NEXT_PUBLIC_`.
- Le client navigateur n'utilise que la clé anonyme Supabase, soumise aux politiques RLS.
- Rotation de clés documentée dans le registre de conformité (doc jamais versionné en clair dans le dépôt).

## 5. Journalisation et audit

- `audit_events` : append-only (pas d'UPDATE/DELETE applicatif ; RLS interdit la modification même aux admins — une correction crée un nouvel événement qui référence l'ancien).
- Le contenu d'un bulletin, le choix d'un électeur ou toute donnée permettant de les déduire sont des champs **interdits** dans `audit_events` par construction du schéma (pas de colonne prévue pour cela) et par revue de code systématique.
- Erreurs applicatives : centralisées (ex. Sentry ou équivalent), avec scrubbing des champs sensibles avant envoi.

## 6. Déploiement et environnements

- `dev` (local), `demo` (Vercel preview, données fictives), à terme `staging` pré-production — jamais de `production` électorale sans le cadre légal du §1 du doc 01.
- Migrations Supabase versionnées dans `/supabase/migrations`, appliquées via CLI, jamais de modification manuelle du schéma en environnement partagé.
- Sauvegardes Supabase testées par restauration périodique (traçée dans le tableau de bord, §12 du cahier des charges).

## 7. Limites et risques résiduels (à documenter en continu)

- Le chiffrement de la phase simulation protège la confidentialité au repos mais ne fournit pas de vérifiabilité de bout en bout (risque accepté en phase démo, bloquant pour un usage officiel).
- Aucune vérification d'identité réelle : un usage officiel nécessite une intégration avec une source d'identité autorisée, hors périmètre actuel.
- La disponibilité réseau en Côte d'Ivoire (coupures, appareils partagés) impose un mécanisme de reprise de session déjà prévu (jeton non consommé = ré-entrant), mais qui doit être testé en conditions réelles avant tout usage à grande échelle.
