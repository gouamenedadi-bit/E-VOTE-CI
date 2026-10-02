# Modèle de rôles et permissions — E-VOTE CI

## 1. Rôles

| Code | Rôle | Portée (`scope`) |
|---|---|---|
| `super_admin` | Super administrateur | Globale |
| `election_admin` | Administrateur électoral | `scope_election_id` (un ou plusieurs scrutins attribués) |
| `station_agent` | Agent de bureau de vote | `scope_polling_station_id` (un bureau) |
| `observer` | Observateur | Globale, mais lecture seule et restreinte aux données publiables/autorisées |
| *(non authentifié)* | Électeur de démonstration | Son propre compte démo uniquement, via jeton |

Un utilisateur peut cumuler plusieurs rôles (ex. `election_admin` sur deux scrutins différents) via plusieurs lignes `user_roles`.

## 2. Matrice de permissions

Légende : ✅ autorisé · 🔶 autorisé avec restriction de portée · ❌ interdit

| Permission | super_admin | election_admin | station_agent | observer | électeur démo |
|---|---|---|---|---|---|
| Créer/configurer un scrutin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier un scrutin qui lui est attribué | ✅ | 🔶 (le sien) | ❌ | ❌ | ❌ |
| Changer le statut d'un scrutin (ouvrir/clôturer) | ✅ | 🔶 (le sien) | ❌ | ❌ | ❌ |
| Gérer les candidats / documents de candidature | ✅ | 🔶 (son scrutin) | ❌ | ❌ | ❌ |
| Configurer bureaux de vote / circonscriptions | ✅ | 🔶 (son scrutin) | ❌ | ❌ | ❌ |
| Attribuer des rôles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Vérifier l'éligibilité d'un électeur démo (son bureau) | ✅ | 🔶 | 🔶 (son bureau) | ❌ | ❌ |
| Enregistrer une participation | ✅ | 🔶 | 🔶 (son bureau) | ❌ | ❌ (automatique via jeton) |
| Modifier un bulletin déjà déposé | ❌ | ❌ | ❌ | ❌ | ❌ |
| Déposer un bulletin pour son propre vote | — | — | — | — | ✅ (via jeton, une seule fois) |
| Lancer le dépouillement | ✅ | 🔶 (son scrutin) | ❌ | ❌ | ❌ |
| Corriger un résultat (avec trace d'audit) | ✅ | 🔶 (son scrutin, si autorisé) | ❌ | ❌ | ❌ |
| Valider/publier des résultats | ✅ | 🔶 (son scrutin) | ❌ | ❌ | ❌ |
| Consulter les résultats publiés | ✅ | ✅ | ✅ | ✅ | ✅ (public) |
| Consulter les PV et rapports de vérification | ✅ | 🔶 (son scrutin) | 🔶 (son bureau) | ✅ (publiables) | ❌ |
| Consulter le journal d'audit | ✅ | 🔶 (son scrutin, actions le concernant) | ❌ | 🔶 (si autorisé) | ❌ |
| **Consulter le choix individuel d'un électeur** | **❌** | **❌** | **❌** | **❌** | ❌ (même lui-même, après dépôt) |
| Consulter son propre statut de participation | — | — | — | — | ✅ (sans révéler le choix) |

La ligne « choix individuel » est interdite pour **tous** les rôles, y compris `super_admin` : c'est une contrainte d'architecture (doc 02 §3), pas seulement une règle d'autorisation applicative — aucune requête, même privilégiée, ne peut relier `voting_credentials` à `encrypted_ballots`.

## 3. Traduction en politiques RLS (principes)

- Chaque permission ci-dessus correspond à une entrée `role_permissions`, vérifiée côté serveur avant toute action (défense en profondeur : RLS **et** contrôle applicative dans `/lib/core`).
- `election_admin` et `station_agent` : la politique RLS filtre systématiquement sur `scope_election_id` / `scope_polling_station_id` via une fonction `current_user_scopes()` exposée à Postgres, pas uniquement côté application — une requête directe à la base reste bornée au périmètre attribué.
- `observer` : RLS limite la lecture aux lignes dont le statut est `published`/`publishable`, jamais `draft`.
- Électeur de démonstration : pas de session Supabase Auth classique nécessairement ; l'accès passe par le jeton de vote vérifié côté serveur (Server Action), qui n'expose jamais de requête directe à `encrypted_ballots` en lecture.

## 4. Séparation des pouvoirs — points de contrôle

- **Double contrôle sur la publication** : un `election_admin` peut préparer une publication (`result_publications.status = 'verified'`), mais le passage à `published` exige une permission distincte (`results.publish`), pouvant être réservée au `super_admin` ou à un second `election_admin`, selon la configuration du scrutin — à décider et documenter par scrutin (champ `rules.publication_requires_dual_control` dans `elections.rules`).
- **Aucun rôle ne peut s'auto-attribuer un rôle** : `user_roles` n'est modifiable que par `super_admin`, jamais par l'utilisateur concerné.
- **Agent de bureau** : ne peut pas administrer un bureau qui ne lui est pas attribué — testé explicitement (voir plan de tests, doc 05 / tests obligatoires).
