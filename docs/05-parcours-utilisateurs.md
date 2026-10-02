# Parcours utilisateurs — E-VOTE CI

## 1. Parcours électeur de démonstration (parcours principal)

| Étape | Écran | Action | Contrôle serveur associé |
|---|---|---|---|
| 1 | Connexion démo | Saisie numéro d'électeur fictif (+ second facteur du scénario) | Vérifie `demo_voters` + éligibilité globale |
| 2 | Tableau de bord électeur | Liste des scrutins ouverts où il est éligible | Filtre `voter_eligibility` + `elections.status = 'open'` |
| 3 | Sélection du scrutin | Choix d'un scrutin | Vérifie qu'aucun jeton `issued`/`consumed` n'existe déjà pour ce couple (électeur, scrutin) |
| 4 | Liste des candidats | Affichage dans l'ordre `ballot_order`, traitement visuel identique | Lecture publique de `candidates` (validés uniquement) |
| 5 | Sélection | L'électeur choisit un candidat ou le vote blanc (si autorisé) | Validation Zod côté client + re-validation serveur |
| 6 | Confirmation | Récapitulatif du choix avant validation | Aucune écriture encore |
| 7 | Validation | L'électeur confirme | Émission du jeton si pas déjà fait (étape 3bis) |
| 8 | Vérification du jeton | — (transparent) | Jeton valide, non expiré, non consommé, correspond au scrutin |
| 9 | Dépôt du bulletin | — (transparent) | Chiffrement + insertion `encrypted_ballots`, transaction atomique |
| 10 | Consommation du jeton | — (transparent) | `voting_credentials.status → consumed` dans la même transaction que l'étape 9 |
| 11 | Reçu de participation | Écran de confirmation | Affiche uniquement « participation enregistrée », jamais le choix |

### Cas de reprise après interruption
- Si la session est interrompue **avant** l'étape 7 (pas encore de jeton émis) : l'électeur recommence sans risque, aucun état n'a été créé.
- Si interrompue **entre** l'émission du jeton et son usage (étape 8-10, ex. coupure réseau après soumission) : à la reconnexion, le serveur vérifie le statut du jeton :
  - `issued` et non expiré → l'électeur peut retenter le dépôt (idempotent : une seule insertion possible grâce à la transaction atomique + verrou).
  - `consumed` → le système affiche directement le reçu de participation (pas de nouveau vote), sans jamais révéler le choix déjà enregistré.
  - `expired` → le système propose de recommencer l'éligibilité (nouveau jeton), l'ancien restant définitivement invalide.
- Dans tous les cas, **deux bulletins ne peuvent jamais être acceptés pour un même jeton** (contrainte d'unicité + verrou transactionnel, doc 03 §8).

## 2. Parcours administrateur électoral — création d'un scrutin

1. Connexion back-office (Supabase Auth + MFA).
2. Tableau de bord admin → « Nouveau scrutin ».
3. Formulaire : type d'élection, nom, description, dates, circonscriptions/bureaux concernés, règles (tours, seuils), documents de référence.
4. Statut initial `draft` → ajout des candidats (avec documents de candidature) → validation de chaque candidat.
5. Passage à `preparing` : vérifications automatiques (candidats validés, bureaux configurés, dates cohérentes) avant d'autoriser le passage à `open`.
6. À `starts_at`, passage automatique (ou manuel confirmé) à `open`.
7. À `ends_at`, passage à `closed` — plus aucun jeton ne peut être émis, les jetons `issued` non consommés expirent.
8. Dépouillement (voir §4) → `audited` → `published`.

Chaque changement de statut génère un `audit_events`.

## 3. Parcours agent de bureau de vote

1. Connexion (Supabase Auth, droits `station_agent` scopés à son `polling_station_id`).
2. Interface restreinte à son bureau : liste des scrutins actifs sur ce bureau.
3. Dans le scénario de démonstration qui simule un contrôle en bureau physique : l'agent confirme la présence/l'éligibilité d'un électeur démo pour ce bureau (ne déclenche pas le dépôt du bulletin, seulement la participation si le scénario le prévoit en mode « bureau »).
4. Ne peut à aucun moment visualiser ou modifier un bulletin déjà déposé (pas de droit RLS sur `encrypted_ballots`).
5. Toute tentative d'accès à un autre bureau est rejetée par RLS **et** par le contrôle applicatif (défense en profondeur, doc 04 §3).

## 4. Parcours dépouillement et publication

1. `election_admin` (ou `super_admin`) lance le dépouillement après `closed`.
2. Le service `/lib/core/tally.ts` déchiffre en mémoire chaque bulletin du scrutin, incrémente les compteurs par candidat/bureau, écrit `tally_records` — jamais de déchiffrement exposé côté client.
3. Réconciliation automatique : `sum(tally_records.vote_count)` par bureau comparé à `count(participation_records)` du même bureau.
   - Écart = 0 → le bureau est marqué cohérent.
   - Écart ≠ 0 → création automatique d'un `incident_reports` (catégorie `reconciliation_mismatch`), le résultat de ce bureau reste `draft`.
4. Génération du PV numérique par bureau (PDF), export CSV des totaux.
5. `result_publications.status = 'verified'` après contrôle (manuel ou par un second rôle, selon `rules.publication_requires_dual_control`).
6. Passage à `published` → apparition sur la page publique des résultats, avec mention explicite du caractère provisoire tant que tous les bureaux ne sont pas `published`.
7. Toute correction après publication repasse par le même circuit (trace d'audit, autorisation), jamais une édition directe de `tally_records`.

## 5. Parcours observateur

1. Connexion (droits `observer`, lecture seule).
2. Consultation des scrutins, PV publiables, résultats publiés, anomalies pour lesquelles il a une autorisation de lecture.
3. Aucune action d'écriture disponible dans l'interface (boutons absents, pas seulement désactivés) — et RLS refuse toute tentative directe.

## 6. Parcours public (sans authentification)

1. Page d'accueil → bandeau « Simulation / Démonstration » toujours visible.
2. Page « Présentation et fonctionnement » → explique le caractère démonstratif, le secret du vote, les limites.
3. Page publique des résultats → filtres (type d'élection, région, département, commune, circonscription, bureau), statut provisoire/définitif toujours affiché, horodatage de dernière actualisation, lien vers PV publiables et rapport de contrôle.

## 7. Cas limites transverses à tester (lien avec le plan de tests)

- Électeur non éligible tentant d'obtenir un jeton → rejeté avant toute émission.
- Deux requêtes de dépôt simultanées pour le même jeton → une seule acceptée (verrou transactionnel).
- Tentative de modification d'un bulletin déposé → aucune route ne l'autorise (pas de endpoint `PATCH`/`UPDATE` sur `encrypted_ballots`).
- Agent tentant d'agir sur un bureau hors de son `scope_polling_station_id` → rejeté par RLS et par le contrôle applicatif.
- Observateur tentant un appel direct d'API d'écriture → rejeté par permission.
- Appareil partagé : le jeton émis est lié à une session courte ; la fermeture de session ne révèle jamais, à l'utilisateur suivant du même appareil, l'état du vote précédent.
