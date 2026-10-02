-- E-VOTE CI — migration initiale (phase simulation)
-- Reference : docs/03-schema-base-de-donnees.md, docs/04-roles-et-permissions.md
-- Principe : separation physique entre le groupe Identite/Participation et
-- le groupe Bulletin/Resultats (aucune cle etrangere entre les deux).

create extension if not exists "pgcrypto";

-- ===========================================================================
-- 1. Referentiels geographiques et organisationnels
-- ===========================================================================

create table regions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions(id),
  code text unique not null,
  name text not null
);

create table communes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  code text unique not null,
  name text not null
);

create table election_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code in
    ('presidentielle','legislatives','municipales','regionales','senatoriales')),
  name text not null,
  rounds_allowed int not null default 1,
  allows_blank_ballot boolean not null default true,
  candidacy_rules jsonb not null default '{}'::jsonb
);

create table constituencies (
  id uuid primary key default gen_random_uuid(),
  election_type_id uuid not null references election_types(id),
  commune_id uuid references communes(id),
  department_id uuid references departments(id),
  region_id uuid references regions(id),
  code text unique not null,
  name text not null,
  seats int not null default 1
);

create table polling_stations (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references communes(id),
  constituency_id uuid not null references constituencies(id),
  code text unique not null,
  name text not null,
  address text,
  is_active boolean not null default true
);

create index on departments(region_id);
create index on communes(department_id);
create index on constituencies(election_type_id);
create index on polling_stations(constituency_id);

-- ===========================================================================
-- 2. Roles et comptes (back-office)
-- ===========================================================================

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code in
    ('super_admin','election_admin','station_agent','observer')),
  name text not null
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  primary key (role_id, permission_id)
);

create table elections (
  id uuid primary key default gen_random_uuid(),
  election_type_id uuid not null references election_types(id),
  name text not null,
  description text,
  round int not null default 1,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in
    ('draft','preparing','open','suspended','closed','audited','published')),
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ends_after_starts check (ends_at > starts_at)
);

create table user_roles (
  user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  scope_election_id uuid references elections(id),
  scope_polling_station_id uuid references polling_stations(id),
  primary key (user_id, role_id, scope_election_id, scope_polling_station_id)
);

create index on user_roles(user_id);
create index on elections(status);

-- ===========================================================================
-- 3. Scrutins, candidats, documents
-- ===========================================================================

create table election_constituencies (
  election_id uuid not null references elections(id),
  constituency_id uuid not null references constituencies(id),
  primary key (election_id, constituency_id)
);

create table election_polling_stations (
  election_id uuid not null references elections(id),
  polling_station_id uuid not null references polling_stations(id),
  primary key (election_id, polling_station_id)
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  constituency_id uuid references constituencies(id),
  display_name text not null,
  party_name text,
  ballot_order int not null,
  photo_url text,
  bio text,
  validation_status text not null default 'pending' check (validation_status in
    ('pending','validated','rejected')),
  created_at timestamptz not null default now(),
  unique (election_id, ballot_order)
);

create table candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id),
  doc_type text not null,
  storage_path text not null,
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now()
);

create table election_documents (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  title text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index on candidates(election_id);

-- ===========================================================================
-- 4. Groupe Identite / Participation
-- ===========================================================================

create table demo_voters (
  id uuid primary key default gen_random_uuid(),
  demo_voter_number text unique not null,
  -- Second facteur de demonstration (doc 01 §4.1) : le numero seul n'est
  -- jamais une preuve d'identite suffisante. Purement fictif ici ; un
  -- usage reel utiliserait un OTP a usage unique, jamais un code fixe
  -- stocke en clair.
  verification_code text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table voter_eligibility (
  id uuid primary key default gen_random_uuid(),
  demo_voter_id uuid not null references demo_voters(id),
  election_id uuid not null references elections(id),
  constituency_id uuid references constituencies(id),
  polling_station_id uuid references polling_stations(id),
  is_eligible boolean not null default true,
  unique (demo_voter_id, election_id)
);

create table voting_credentials (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  demo_voter_id uuid not null references demo_voters(id),
  election_id uuid not null references elections(id),
  status text not null default 'issued' check (status in
    ('issued','consumed','expired','revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- Unicite partielle : un seul jeton ACTIF (issued/consumed) a la fois par
-- electeur/scrutin, mais un nouveau jeton peut etre emis apres expiration
-- (reprise de session, doc 05 §1) sans jamais permettre deux jetons
-- actifs simultanes (empeche le double vote, doc 06 T2).
create unique index voting_credentials_active_unique
  on voting_credentials (demo_voter_id, election_id)
  where status in ('issued', 'consumed');

create table participation_records (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  polling_station_id uuid references polling_stations(id),
  credential_id uuid not null references voting_credentials(id),
  recorded_at timestamptz not null default now()
);

create index on voter_eligibility(election_id);
create index on voting_credentials(election_id);
create index on participation_records(election_id, polling_station_id);

-- ===========================================================================
-- 5. Groupe Bulletin / Resultats — AUCUNE cle etrangere vers le groupe
--    Identite (doc 03 §1). Ne jamais ajouter demo_voter_id ni credential_id
--    dans encrypted_ballots.
-- ===========================================================================

create table encrypted_ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  constituency_id uuid references constituencies(id),
  polling_station_id uuid references polling_stations(id),
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  wrapped_data_key bytea not null,
  encryption_key_id text not null,
  integrity_prev_hash text not null,
  integrity_record_hash text not null,
  recorded_at timestamptz not null default now()
);

create table tally_records (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  polling_station_id uuid references polling_stations(id),
  candidate_id uuid references candidates(id),
  ballot_type text not null check (ballot_type in ('valid','blank','null')),
  vote_count int not null default 0,
  integrity_prev_hash text not null,
  integrity_record_hash text not null,
  computed_at timestamptz not null default now(),
  computed_by uuid references users(id)
);

create table result_publications (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  scope_level text not null check (scope_level in
    ('polling_station','commune','department','region','national')),
  scope_id uuid,
  status text not null default 'draft' check (status in ('draft','verified','published')),
  published_at timestamptz,
  published_by uuid references users(id)
);

create index on encrypted_ballots(election_id);
create index on tally_records(election_id, polling_station_id);
create index on result_publications(election_id, status);

-- ===========================================================================
-- 6. Audit et conformite
-- ===========================================================================

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action_code text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  prev_hash text not null,
  record_hash text not null,
  occurred_at timestamptz not null default now()
);

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id),
  category text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','investigating','resolved')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index on audit_events(occurred_at);
create index on incident_reports(election_id, status);

-- ===========================================================================
-- 7. Fonction de consommation atomique du jeton (doc 02 §3.2, doc 06 T3)
--    Appelee via supabase.rpc() depuis l'adaptateur serveur. Le verrou
--    `for update` empeche toute double consommation concurrente.
-- ===========================================================================

-- Le resultat porte un champ `outcome` plutot que de s'appuyer sur des
-- exceptions SQL : une exception non interceptee annulerait aussi les
-- mises a jour deja faites dans la meme transaction (ex. le passage a
-- 'expired'), ce qui n'est pas le comportement voulu. L'adaptateur TS
-- (lib/db/repositories/credential-repository.ts) lit `outcome` et le
-- traduit vers ConsumeResult.
-- Note : la verification que le jeton correspond bien au scrutin attendu
-- est refaite cote TS (lib/core/voting-token.ts consumeVotingToken) a
-- partir de election_id renvoye ici — cette fonction ne fait que la
-- transition d'etat atomique par token_hash.
create or replace function consume_voting_credential(
  p_token_hash text
) returns table (
  outcome text,
  id uuid,
  demo_voter_id uuid,
  election_id uuid,
  status text,
  issued_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz
) language plpgsql security definer as $$
declare
  v_row voting_credentials%rowtype;
begin
  select * into v_row
  from voting_credentials
  where token_hash = p_token_hash
  for update;

  if v_row.id is null then
    return query select 'not_found'::text, null::uuid, null::uuid, null::uuid,
      null::text, null::timestamptz, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_row.status = 'revoked' then
    return query select 'revoked'::text, v_row.id, v_row.demo_voter_id, v_row.election_id,
      v_row.status, v_row.issued_at, v_row.expires_at, v_row.consumed_at;
    return;
  end if;

  if v_row.status = 'consumed' then
    return query select 'already_consumed'::text, v_row.id, v_row.demo_voter_id, v_row.election_id,
      v_row.status, v_row.issued_at, v_row.expires_at, v_row.consumed_at;
    return;
  end if;

  if v_row.expires_at < now() then
    update voting_credentials set status = 'expired' where voting_credentials.id = v_row.id;
    return query select 'expired'::text, v_row.id, v_row.demo_voter_id, v_row.election_id,
      'expired'::text, v_row.issued_at, v_row.expires_at, v_row.consumed_at;
    return;
  end if;

  update voting_credentials
  set status = 'consumed', consumed_at = now()
  where voting_credentials.id = v_row.id
  returning * into v_row;

  return query select 'ok'::text, v_row.id, v_row.demo_voter_id, v_row.election_id,
    v_row.status, v_row.issued_at, v_row.expires_at, v_row.consumed_at;
end;
$$;

-- ===========================================================================
-- 8. RLS — activation et politiques de base (doc 04 §3)
--    Principe : la cle de service (utilisee par les Server Actions) n'est
--    jamais soumise a RLS ; ces politiques protegent l'acces direct via la
--    cle anonyme (navigateur authentifie en tant qu'admin/agent/observateur).
-- ===========================================================================

alter table users enable row level security;
alter table user_roles enable row level security;
alter table demo_voters enable row level security;
alter table voter_eligibility enable row level security;
alter table voting_credentials enable row level security;
alter table participation_records enable row level security;
alter table encrypted_ballots enable row level security;
alter table tally_records enable row level security;
alter table result_publications enable row level security;
alter table audit_events enable row level security;
alter table incident_reports enable row level security;
alter table elections enable row level security;
alter table candidates enable row level security;

-- Lecture publique anonyme des scrutins et candidats valides, et des
-- resultats publies uniquement.
create policy public_read_elections on elections
  for select using (true);

create policy public_read_validated_candidates on candidates
  for select using (validation_status = 'validated');

create policy public_read_published_results on result_publications
  for select using (status = 'published');

-- Un utilisateur authentifie ne voit que ses propres roles.
create policy user_sees_own_roles on user_roles
  for select using (user_id = auth.uid());

-- super_admin : acces large en lecture sur les tables d'administration,
-- mais JAMAIS de droit sur encrypted_ballots (aucune policy select n'est
-- definie pour un role applicatif sur cette table : seule la cle de
-- service, hors RLS, peut l'interroger pour le depouillement).
create policy super_admin_reads_audit on audit_events
  for select using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.code = 'super_admin'
    )
  );

create policy super_admin_reads_incidents on incident_reports
  for select using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.code = 'super_admin'
    )
  );

-- election_admin : lecture/ecriture bornee a son scope_election_id.
create policy election_admin_scope_elections on elections
  for update using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code in ('super_admin','election_admin')
        and (r.code = 'super_admin' or ur.scope_election_id = elections.id)
    )
  );

create policy election_admin_scope_candidates on candidates
  for all using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code in ('super_admin','election_admin')
        and (r.code = 'super_admin' or ur.scope_election_id = candidates.election_id)
    )
  );

-- station_agent : borne a son scope_polling_station_id, lecture seule sur
-- les participations de son bureau (jamais sur encrypted_ballots).
create policy station_agent_scope_participation on participation_records
  for select using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code in ('super_admin','station_agent')
        and (r.code = 'super_admin' or ur.scope_polling_station_id = participation_records.polling_station_id)
    )
  );

-- Remarque : aucune policy n'autorise la lecture de voting_credentials ou
-- demo_voters pour un role applicatif — ces tables ne sont lues que par la
-- cle de service, dans les Server Actions de /lib/core (doc 04 §3).
