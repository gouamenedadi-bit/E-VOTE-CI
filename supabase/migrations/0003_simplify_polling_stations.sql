-- Simplification de prototype pour la gestion des bureaux de vote.
-- La hierarchie geographique complete (regions/departments/communes/
-- constituencies) decrite dans 0001_init.sql reste le modele cible, mais
-- n'est pas encore alimentee avec les vraies divisions administratives
-- ivoiriennes (hors perimetre de cet increment). En attendant, un bureau
-- de vote porte directement un nom de commune en texte libre, et n'est
-- plus rattache obligatoirement a une circonscription.
--
-- A corriger avant un usage officiel : remplacer commune_name par une
-- veritable reference a `communes`, redevenir not null sur commune_id et
-- constituency_id une fois la geographie reelle chargee (doc 01 §16).

alter table polling_stations
  alter column commune_id drop not null,
  alter column constituency_id drop not null,
  add column commune_name text;

alter table polling_stations
  add constraint polling_stations_commune_reference check (
    commune_id is not null or commune_name is not null
  );
