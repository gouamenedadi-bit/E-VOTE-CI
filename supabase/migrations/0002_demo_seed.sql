-- Donnees de demonstration — memes donnees que lib/demo/store.ts, pour
-- garder le meme scenario clickable une fois Supabase connecte.
-- Entierement fictif (doc 01 §1).

insert into election_types (id, code, name, rounds_allowed, allows_blank_ballot)
values ('11111111-1111-1111-1111-111111111111', 'presidentielle', 'Présidentielle', 2, true)
on conflict (code) do nothing;

insert into elections (id, election_type_id, name, description, round, starts_at, ends_at, status)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Présidentielle — Simulation',
  'Scrutin de démonstration, données entièrement fictives.',
  1,
  now() - interval '1 hour',
  now() + interval '7 days',
  'open'
)
on conflict (id) do nothing;

insert into candidates (id, election_id, display_name, party_name, ballot_order, validation_status)
values
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Candidat A', 'Parti A', 1, 'validated'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Candidat B', 'Parti B', 2, 'validated')
on conflict (election_id, ballot_order) do nothing;

insert into demo_voters (id, demo_voter_number, verification_code, full_name)
values
  ('44444444-4444-4444-4444-444444444441', '0000001', '123456', 'Électeur Démo 1'),
  ('44444444-4444-4444-4444-444444444442', '0000002', '123456', 'Électeur Démo 2'),
  ('44444444-4444-4444-4444-444444444443', '0000003', '123456', 'Électeur Démo 3')
on conflict (demo_voter_number) do nothing;

insert into voter_eligibility (demo_voter_id, election_id, is_eligible)
values
  ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222222222', true),
  ('44444444-4444-4444-4444-444444444442', '22222222-2222-2222-2222-222222222222', true),
  ('44444444-4444-4444-4444-444444444443', '22222222-2222-2222-2222-222222222222', true)
on conflict (demo_voter_id, election_id) do nothing;
