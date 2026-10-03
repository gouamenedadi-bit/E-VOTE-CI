-- Geographie reelle de la Cote d'Ivoire (31 regions + les districts
-- autonomes d'Abidjan et Yamoussoukro, traites ici comme des regions —
-- ce schema ne modelise pas de niveau "district", doc 03 §1).
--
-- Seed REPRESENTATIF, pas exhaustif : un seul departement et une seule
-- commune (le chef-lieu) par region, alors que le pays compte reellement
-- 111 departements et de nombreuses communes par region. A completer
-- depuis une source officielle (INS, decoupage electoral de la CEI)
-- avant tout usage au-dela du prototype — voir docs/01 §16 (centre de
-- conformite) et README.

insert into regions (code, name) values
  ('ABJ', 'Abidjan'),
  ('AGT', 'Agnéby-Tiassa'),
  ('BAF', 'Bafing'),
  ('BAG', 'Bagoué'),
  ('BEL', 'Bélier'),
  ('BER', 'Béré'),
  ('BNK', 'Bounkani'),
  ('CAV', 'Cavally'),
  ('FOL', 'Folon'),
  ('GBK', 'Gbêkê'),
  ('GBO', 'Gbôklé'),
  ('GOH', 'Gôh'),
  ('GON', 'Gontougo'),
  ('GRP', 'Grands-Ponts'),
  ('GUE', 'Guémon'),
  ('HAM', 'Hambol'),
  ('HSA', 'Haut-Sassandra'),
  ('IFF', 'Iffou'),
  ('IND', 'Indénié-Djuablin'),
  ('KAB', 'Kabadougou'),
  ('MEE', 'Mé'),
  ('LOH', 'Lôh-Djiboua'),
  ('MAR', 'Marahoué'),
  ('MOR', 'Moronou'),
  ('NAW', 'Nawa'),
  ('NZI', 'N''Zi'),
  ('POR', 'Poro'),
  ('SPE', 'San-Pédro'),
  ('SUC', 'Sud-Comoé'),
  ('TCH', 'Tchologo'),
  ('WOR', 'Worodougou'),
  ('YAM', 'Yamoussoukro')
on conflict (code) do nothing;

-- Un departement "chef-lieu" par region (meme nom que la commune).
insert into departments (region_id, code, name)
select r.id, r.code || '-DEP', chief.name
from regions r
join (values
  ('ABJ','Abidjan'), ('AGT','Agboville'), ('BAF','Touba'), ('BAG','Boundiali'),
  ('BEL','Toumodi'), ('BER','Mankono'), ('BNK','Bouna'), ('CAV','Guiglo'),
  ('FOL','Minignan'), ('GBK','Bouaké'), ('GBO','Sassandra'), ('GOH','Gagnoa'),
  ('GON','Bondoukou'), ('GRP','Dabou'), ('GUE','Duékoué'), ('HAM','Katiola'),
  ('HSA','Daloa'), ('IFF','Daoukro'), ('IND','Abengourou'), ('KAB','Odienné'),
  ('MEE','Adzopé'), ('LOH','Divo'), ('MAR','Bouaflé'), ('MOR','Bongouanou'),
  ('NAW','Soubré'), ('NZI','Dimbokro'), ('POR','Korhogo'), ('SPE','San-Pédro'),
  ('SUC','Aboisso'), ('TCH','Ferkessédougou'), ('WOR','Séguéla'), ('YAM','Yamoussoukro')
) as chief(region_code, name) on chief.region_code = r.code
on conflict (code) do nothing;

-- Une commune "chef-lieu" par departement (meme nom).
insert into communes (department_id, code, name)
select d.id, r.code || '-COM', d.name
from departments d
join regions r on r.id = d.region_id
where d.code like '%-DEP'
on conflict (code) do nothing;
