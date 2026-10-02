# Schéma de base de données — E-VOTE CI

PostgreSQL (Supabase), RLS activé sur toutes les tables contenant des données sensibles. Les migrations vivent dans `/supabase/migrations/NNNN_description.sql`.

## 1. Principe de séparation (rappel architecture, doc 02 §3)

Deux groupes de tables **sans clé étrangère entre eux** :
- **Groupe Identité/Participation** : `demo_voters`, `voter_eligibility`, `voting_credentials`, `participation_records`.
- **Groupe Bulletin/Résultats** : `encrypted_ballots`, `tally_records`, `result_publications`.

Le pont entre les deux groupes est le **jeton** (`voting_credentials.token_id`), qui est consommé (passe à `consumed`) exactement au moment où un bulletin est inséré — mais `encrypted_ballots` ne stocke pas `voter_id` ni `token_id` en clair comme clé étrangère exploitable ; il stocke un `ballot_ref` aléatoire indépendant, et la correspondance `token → ballot` n'est conservée dans aucune table lisible (voir §4 pour le détail transactionnel).

## 2. Référentiels géographiques et organisationnels

```sql
regions (
  id uuid pk,
  code text unique,
  name text not null
)

departments (
  id uuid pk,
  region_id uuid fk → regions,
  code text unique,
  name text not null
)

communes (
  id uuid pk,
  department_id uuid fk → departments,
  code text unique,
  name text not null
)

constituencies (            -- circonscriptions électorales (législatives, etc.)
  id uuid pk,
  election_type_id uuid fk → election_types,
  commune_id uuid fk → communes null,   -- selon le type d'élection
  department_id uuid fk → departments null,
  region_id uuid fk → regions null,
  code text unique,
  name text not null,
  seats int not null default 1
)

polling_stations (          -- bureaux de vote
  id uuid pk,
  commune_id uuid fk → communes,
  constituency_id uuid fk → constituencies,
  code text unique,
  name text not null,
  address text,
  is_active boolean default true
)
```

Index : `communes(department_id)`, `constituencies(election_type_id)`, `polling_stations(constituency_id)`.

## 3. Élections, types, candidats

```sql
election_types (
  id uuid pk,
  code text unique,          -- 'presidentielle' | 'legislatives' | 'municipales' | 'regionales' | 'senatoriales'
  name text not null,
  rounds_allowed int not null default 1,   -- ex. présidentielle = 2 si second tour
  allows_blank_ballot boolean default true,
  candidacy_rules jsonb       -- règles spécifiques (seuils, parrainages, etc.)
)

elections (                  -- un scrutin concret (ex. "Présidentielle 2026 - Simulation")
  id uuid pk,
  election_type_id uuid fk → election_types,
  name text not null,
  description text,
  round int not null default 1,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in
    ('draft','preparing','open','suspended','closed','audited','published')),
  rules jsonb,                -- règles du scrutin (seuils, mode de calcul)
  created_by uuid fk → users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

election_constituencies (    -- une élection peut couvrir plusieurs circonscriptions
  election_id uuid fk → elections,
  constituency_id uuid fk → constituencies,
  primary key (election_id, constituency_id)
)

election_polling_stations (  -- bureaux rattachés à un scrutin
  election_id uuid fk → elections,
  polling_station_id uuid fk → polling_stations,
  primary key (election_id, polling_station_id)
)

candidates (
  id uuid pk,
  election_id uuid fk → elections,
  constituency_id uuid fk → constituencies null,  -- null si liste nationale (présidentielle)
  display_name text not null,       -- nom du candidat ou de la liste
  party_name text,
  ballot_order int not null,        -- numéro d'ordre, défini avant ouverture
  photo_url text,                   -- Supabase Storage, documents publics uniquement
  bio text,
  validation_status text not null check (validation_status in
    ('pending','validated','rejected')),
  created_at timestamptz default now(),
  unique (election_id, ballot_order)
)

candidate_documents (
  id uuid pk,
  candidate_id uuid fk → candidates,
  doc_type text not null,           -- 'candidature', 'declaration', etc.
  storage_path text not null,
  uploaded_by uuid fk → users,
  uploaded_at timestamptz default now()
)

election_documents (          -- textes de référence, règlements, PV modèles
  id uuid pk,
  election_id uuid fk → elections,
  title text not null,
  storage_path text not null,
  uploaded_at timestamptz default now()
)
```

Contrainte clé : `unique (election_id, ballot_order)` empêche deux candidats d'avoir le même numéro dans le même scrutin — l'ordre d'affichage est donc figé et vérifiable dès la création, pas recalculé à l'affichage.

## 4. Identité, rôles et accès (Groupe Identité)

```sql
roles (
  id uuid pk,
  code text unique check (code in
    ('super_admin','election_admin','station_agent','observer')),
  name text not null
)

users (                       -- comptes authentifiés (back-office), via Supabase Auth
  id uuid pk references auth.users,
  full_name text not null,
  email text unique not null,
  mfa_enabled boolean default false,
  created_at timestamptz default now()
)

user_roles (
  user_id uuid fk → users,
  role_id uuid fk → roles,
  scope_election_id uuid fk → elections null,     -- admin électoral : scrutins attribués
  scope_polling_station_id uuid fk → polling_stations null, -- agent : bureau attribué
  primary key (user_id, role_id, scope_election_id, scope_polling_station_id)
)

permissions (
  id uuid pk,
  code text unique,            -- ex. 'election.create', 'results.publish'
  description text
)

role_permissions (
  role_id uuid fk → roles,
  permission_id uuid fk → permissions,
  primary key (role_id, permission_id)
)

demo_voters (                 -- électeurs FICTIFS uniquement
  id uuid pk,
  demo_voter_number text unique not null,   -- numéro d'électeur fictif
  full_name text,                            -- facultatif, démonstration uniquement
  created_at timestamptz default now()
)

voter_eligibility (
  id uuid pk,
  demo_voter_id uuid fk → demo_voters,
  election_id uuid fk → elections,
  constituency_id uuid fk → constituencies,
  polling_station_id uuid fk → polling_stations,
  is_eligible boolean default true,
  unique (demo_voter_id, election_id)
)

voting_credentials (          -- émission / consommation du jeton
  id uuid pk,
  token_hash text unique not null,   -- hash du jeton ; le jeton brut n'est jamais stocké
  demo_voter_id uuid fk → demo_voters,   -- présent UNIQUEMENT ici, jamais côté bulletin
  election_id uuid fk → elections,
  status text not null check (status in ('issued','consumed','expired','revoked')),
  issued_at timestamptz default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  unique (demo_voter_id, election_id)    -- empêche un second jeton pour le même scrutin
)

participation_records (
  id uuid pk,
  election_id uuid fk → elections,
  polling_station_id uuid fk → polling_stations null,
  credential_id uuid fk → voting_credentials,  -- preuve de participation, pas le bulletin
  recorded_at timestamptz default now()
)
```

`voting_credentials.token_hash` : le jeton transmis au navigateur est une valeur aléatoire opaque ; seul son hash (ex. SHA-256 salé) est stocké côté serveur, pour éviter qu'une fuite de la base ne permette de rejouer un jeton valide.

## 5. Bulletins et résultats (Groupe Bulletin)

```sql
encrypted_ballots (
  id uuid pk,                         -- ballot_ref, totalement indépendant du jeton
  election_id uuid fk → elections,
  constituency_id uuid fk → constituencies null,
  polling_station_id uuid fk → polling_stations null,
  ciphertext bytea not null,          -- contenu chiffré (AES-256-GCM, clé enveloppe)
  encryption_key_id text not null,    -- référence à la clé maîtresse utilisée, pas la clé elle-même
  integrity_proof text not null,      -- empreinte / HMAC pour détecter toute altération
  recorded_at timestamptz default now()
  -- PAS de colonne demo_voter_id, PAS de colonne credential_id/token_id
)

tally_records (
  id uuid pk,
  election_id uuid fk → elections,
  polling_station_id uuid fk → polling_stations null,
  candidate_id uuid fk → candidates null,   -- null = blanc/nul, voir ballot_type
  ballot_type text not null check (ballot_type in ('valid','blank','null')),
  vote_count int not null default 0,
  computed_at timestamptz default now(),
  computed_by uuid fk → users
)

result_publications (
  id uuid pk,
  election_id uuid fk → elections,
  scope_level text not null check (scope_level in
    ('polling_station','commune','department','region','national')),
  scope_id uuid,                      -- pointe vers la table correspondant à scope_level
  status text not null check (status in ('draft','verified','published')),
  published_at timestamptz null,
  published_by uuid fk → users null
)
```

Réconciliation : un contrôle périodique compare `count(participation_records)` par bureau/scrutin à `sum(tally_records.vote_count)` pour le même périmètre, et toute divergence génère un `incident_reports` (voir §6) — jamais une correction automatique silencieuse.

## 6. Audit et conformité

```sql
audit_events (                 -- append-only, jamais de contenu de bulletin
  id uuid pk,
  actor_user_id uuid fk → users null,
  action_code text not null,        -- ex. 'election.status_changed'
  target_type text not null,
  target_id uuid,
  metadata jsonb,                   -- jamais de choix électoral, jamais de contenu de bulletin
  occurred_at timestamptz default now()
)

incident_reports (
  id uuid pk,
  election_id uuid fk → elections null,
  category text not null,           -- 'reconciliation_mismatch','security','availability', ...
  description text not null,
  status text not null check (status in ('open','investigating','resolved')),
  opened_at timestamptz default now(),
  resolved_at timestamptz null
)
```

## 7. Politiques RLS — principes (détail complet dans doc 04)

- `demo_voters`, `voter_eligibility`, `voting_credentials`, `participation_records` : lecture/écriture limitée au service serveur (clé de service) pour les opérations critiques ; un électeur authentifié ne voit que ses propres lignes, jamais celles d'un autre.
- `encrypted_ballots` : **aucun rôle applicatif** (y compris super_admin) n'a de droit `SELECT` sur `ciphertext` en clair via l'API publique ; seul le service de dépouillement (clé de service, fonction dédiée) peut déchiffrer en mémoire pour produire `tally_records`.
- `candidates`, `elections`, `result_publications` (statut `published`) : lecture publique anonyme autorisée.
- `audit_events`, `incident_reports` : lecture réservée aux rôles `super_admin`/`observer` selon permission ; écriture réservée au service serveur, jamais d'`UPDATE`/`DELETE` applicatif.
- `user_roles` : un `election_admin` ou `station_agent` ne peut agir que dans le `scope_election_id`/`scope_polling_station_id` qui lui est attribué — appliqué à la fois en RLS et en vérification applicative (défense en profondeur).

## 8. Index et contraintes critiques à ne pas omettre

- `voting_credentials (demo_voter_id, election_id) UNIQUE` → empêche un second jeton pour le même scrutin.
- `voting_credentials (token_hash) UNIQUE` → empêche la collision/réémission.
- Transition de statut du jeton (`issued → consumed`) et insertion dans `encrypted_ballots` dans **une seule transaction** avec verrou (`SELECT ... FOR UPDATE` sur la ligne du jeton) pour empêcher la double soumission concurrente.
- `candidates (election_id, ballot_order) UNIQUE`.
- Index sur toutes les colonnes de clé étrangère utilisées dans les filtres de résultats (`tally_records(election_id, polling_station_id)`, etc.).
