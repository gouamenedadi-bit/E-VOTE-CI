# Plan de sécurité détaillé — E-VOTE CI (phase simulation)

## 1. Périmètre

Ce plan couvre la phase « simulation ». Il décrit le modèle de menaces, les contre-mesures retenues, le mécanisme d'intégrité par chaînage de hachage (décision prise avec l'utilisateur le 2026-10-03 : pas de blockchain distribuée en phase prototype), et les tests de sécurité obligatoires. Il documente aussi, explicitement, ce qui resterait à faire avant tout usage officiel.

## 2. Modèle de menaces

| # | Menace | Actif visé | Impact | Contre-mesure |
|---|---|---|---|---|
| T1 | Usurpation d'un électeur (numéro connu d'un tiers) | Identité | Vote au nom d'autrui | Second facteur à l'identification, jeton unique lié au couple (électeur, scrutin) |
| T2 | Vote multiple pour un même scrutin | Intégrité du résultat | Résultat faussé | Contrainte `UNIQUE(demo_voter_id, election_id)`, jeton à usage unique, transaction atomique à la consommation |
| T3 | Double soumission réseau simultanée (replay) | Intégrité du résultat | Double comptage | Verrou `SELECT ... FOR UPDATE` sur le jeton + transaction unique dépôt+consommation |
| T4 | Interception réseau | Confidentialité | Vol de jeton/credentials | HTTPS/TLS obligatoire, HSTS, cookies `Secure`/`HttpOnly` |
| T5 | Fuite de la base de données | Secret du vote | Reconstitution d'un vote | Séparation physique identité/bulletin (doc 02 §3), bulletins chiffrés, jeton stocké en hash (jamais en clair) |
| T6 | Altération rétroactive d'un bulletin ou d'un résultat déjà enregistré | Intégrité du résultat | Fraude indétectable | Chaînage de hachage append-only (§3), aucune route `UPDATE`/`DELETE` applicative sur ces tables |
| T7 | Abus de privilège d'un administrateur (consulter un choix individuel) | Secret du vote | Violation du secret du vote | Impossibilité structurelle (pas de FK exploitable), pas de permission qui l'autorise, revue de code |
| T8 | Collusion interne (admin + accès technique) pour modifier discrètement le code ou les données | Intégrité globale | Fraude à grande échelle | Revue de code obligatoire, environnements séparés, secrets hors dépôt, chaînage de hachage + ancrage périodique public (§3.3) |
| T9 | Force brute sur les comptes admin/agent | Contrôle d'accès | Prise de contrôle d'un compte | MFA obligatoire pour admin/agent, limitation de tentatives, verrouillage progressif |
| T10 | Injection SQL | Intégrité/confidentialité | Accès non autorisé aux données | Requêtes paramétrées (client Supabase), pas de SQL dynamique concaténé |
| T11 | XSS | Confidentialité/intégrité session | Vol de session, actions non désirées | Échappement systématique (React), Content-Security-Policy stricte, pas de `dangerouslySetInnerHTML` sur contenu non maîtrisé |
| T12 | CSRF sur les actions critiques (vote, changement de statut) | Intégrité | Action exécutée à l'insu de l'utilisateur | Jetons CSRF natifs des Server Actions Next.js, vérification de l'origine, `SameSite=Lax/Strict` |
| T13 | Déni de service applicatif (page résultats, identification) | Disponibilité | Indisponibilité du service | Limitation de débit (rate limiting) par IP/compte, cache des pages publiques, CDN Vercel |
| T14 | Coupure réseau/électrique côté électeur pendant le vote | Disponibilité / intégrité | Session interrompue | Jeton réentrant, reprise de session sans double vote (doc 05 §1) |
| T15 | Incident de disponibilité serveur/base | Disponibilité | Interruption du scrutin | Sauvegardes testées, plan de reprise (RTO/RPO définis §6) |
| T16 | Falsification rétroactive de la chaîne de hachage elle-même (réécriture complète de l'historique) | Intégrité du résultat | Fraude indétectable si rien n'ancre la chaîne à l'extérieur | Ancrage périodique du hash de tête hors base (§3.3) |

## 3. Mécanisme d'intégrité par chaînage de hachage

### 3.1 Principe
Chaque table append-only sensible (`audit_events`, `tally_records`, et les métadonnées d'intégrité de `encrypted_ballots`) reçoit deux colonnes supplémentaires :
- `prev_hash` : hash de l'enregistrement précédent dans la même chaîne (par table, éventuellement par scrutin pour `tally_records`/`encrypted_ballots`).
- `record_hash` : `SHA-256(contenu_canonique_de_la_ligne ‖ prev_hash)`, calculé côté serveur au moment de l'insertion, jamais recalculable a posteriori sans casser la chaîne suivante.

Le premier enregistrement d'une chaîne utilise un `prev_hash` initial public et documenté (ex. hash du scrutin lui-même), qui sert de point d'ancrage de départ.

### 3.2 Vérification
Une fonction `/lib/core/integrity.ts` recalcule la chaîne complète d'un scrutin et compare le dernier `record_hash` obtenu à la valeur publiée (§3.3). Toute divergence signale une altération et doit déclencher un `incident_reports` (catégorie `security`).

### 3.3 Ancrage périodique (ce qui remplace la blockchain distribuée en phase prototype)
Le dernier `record_hash` de chaque chaîne est publié périodiquement (ex. toutes les heures pendant un scrutin ouvert, et à chaque changement de statut) sur un canal que l'administrateur ne contrôle pas seul en écriture après coup — en phase simulation : export signé horodaté accessible sur la page publique « Rapport de contrôle » et conservé hors de la base principale (ex. objet Supabase Storage en écriture additive, ou journal externe). Cela rend une réécriture rétroactive détectable même par un administrateur, car il faudrait aussi falsifier toutes les publications passées.

### 3.4 Évolution vers un registre distribué multi-parties (hors périmètre prototype)
Pour un usage officiel, remplacer l'ancrage centralisé par un registre partagé entre parties indépendantes (CEI, partis, observateurs), chacune opérant son propre nœud de vérification — décision explicitement différée (voir doc 02 §7 et accord du 2026-10-03). Ne pas improviser ce passage sans expertise dédiée.

## 4. Authentification et contrôle d'accès

- MFA obligatoire pour `super_admin`, `election_admin`, `station_agent` (Supabase Auth).
- Scoping RLS strict (`scope_election_id`, `scope_polling_station_id`) + contrôle applicatif redondant (défense en profondeur, doc 04 §3).
- Sessions courtes pour l'espace électeur de démonstration, pas de réutilisation d'un jeton après expiration.
- Aucune clé secrète ni clé de service côté navigateur (doc 02 §4).

## 5. Protections applicatives

- Validation Zod systématique en entrée de chaque Server Action / Route Handler, y compris sur des champs déjà validés côté client.
- En-têtes de sécurité : CSP stricte, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`.
- Rate limiting sur les endpoints sensibles (identification, émission de jeton, connexion admin).
- Pas de requête SQL concaténée dynamiquement ; tout accès passe par le client Supabase typé ou des fonctions SQL paramétrées.

## 6. Sauvegardes, continuité, reprise après incident

- Sauvegardes Supabase automatiques + restauration testée mensuellement en environnement démo (traçée dans le tableau de bord, doc 01 §12).
- Objectifs phase simulation : RPO ≤ 24h, RTO ≤ 4h (à revoir et durcir avant tout usage à plus fort enjeu).
- Procédure d'incident documentée : détection → qualification (`incident_reports`) → confinement → communication → résolution → retour d'expérience.

## 7. Plan de tests de sécurité obligatoires

### 7.1 Tests fonctionnels de sécurité (unitaires/e2e — voir cahier des charges §17)
Repris et complétés dans `/tests` :
1. Un électeur non éligible ne peut pas obtenir de jeton.
2. Un jeton ne peut être consommé qu'une fois (y compris sous requêtes concurrentes — test de concurrence explicite).
3. Deux dépôts simultanés pour le même jeton n'aboutissent qu'à un seul bulletin enregistré.
4. Aucune route n'autorise la modification d'un bulletin déposé.
5. Aucune requête, même en tant que `super_admin`, ne permet de relier un électeur à son bulletin.
6. Un `observer` ne peut exécuter aucune action d'écriture.
7. Un `station_agent` ne peut pas agir sur un bureau hors de son périmètre.
8. Les totaux recalculés à partir de `encrypted_ballots` correspondent exactement à `tally_records`.
9. La réconciliation détecte un écart introduit volontairement dans un jeu de test.
10. La chaîne de hachage détecte toute altération d'un enregistrement passé (test d'altération volontaire en base de test).
11. Les journaux d'audit ne contiennent, sous aucune forme, le choix d'un électeur.
12. Une session interrompue puis reprise ne crée jamais de second bulletin.

### 7.2 Tests de charge

Outil retenu : **k6** (scripts dans `tests/load/`). Deux scénarios, conformes au plan initial :

| Scénario | Script | Charge testée | Seuils | Résultat (2026-10-03, build de production locale) |
|---|---|---|---|---|
| Pic d'identification à l'ouverture d'un scrutin | `identification-spike.js` | Montée à 50 utilisateurs virtuels en 10s, maintenue 20s | p95 < 2000 ms, < 1 % d'échecs | **p95 = 258 ms, 0 % d'échecs** sur 7396 requêtes (184 req/s) |
| Pic de consultation des résultats à la clôture | `resultats-spike.js` | Montée à 100 utilisateurs virtuels en 10s, maintenue 20s | p95 < 1500 ms, < 1 % d'échecs | **p95 = 237 ms, 0 % d'échecs** sur 20181 requêtes (504 req/s) |

Exécution : `npm run build && npm run start` (build de production — jamais `next dev`, non représentatif), puis `BASE_URL=http://localhost:3000 k6 run tests/load/<script>.js`.

**Limites de ce résultat** : mesuré sur une machine de développement locale, avec le magasin de démonstration en mémoire (pas de latence réseau vers une vraie base Supabase, pas de contention sur un pool de connexions partagé). Les Server Actions Next.js n'acceptent une soumission que si le corps est réellement `multipart/form-data` — les scripts l'encodent à la main (k6 ne le fait pas automatiquement sans `http.file()`). Ce résultat confirme que l'architecture ne s'effondre pas sous une charge modeste ; il ne remplace pas un test de charge en environnement de préproduction avec une vraie base de données avant tout usage à grande échelle.

### 7.3 Test de pénétration
- Portée : OWASP Top 10, logique métier du jeton/bulletin, contrôle d'accès RLS.
- À réaliser par une équipe externe indépendante **avant** toute étape vers un usage non strictement interne, et obligatoirement avant toute évolution vers un usage officiel.

### 7.4 Test de reprise après incident
- Simulation de perte de la base démo → restauration depuis sauvegarde → vérification de la chaîne de hachage après restauration → vérification qu'aucun scrutin ouvert n'a produit de double vote pendant la bascule.

## 8. Limites et risques résiduels assumés (phase simulation)

- Le chaînage de hachage garantit l'intégrité/traçabilité, pas la vérifiabilité cryptographique de bout en bout d'un vote individuel sans révéler le choix (qui resterait nécessaire pour un usage officiel, doc 02 §3.4).
- L'ancrage périodique centralisé (§3.3) réduit mais n'élimine pas totalement le risque de collusion si une seule personne contrôle à la fois la base et le canal d'ancrage — raison explicite du passage recommandé à un registre multi-parties avant tout usage officiel.
- Aucune vérification d'identité réelle n'est en place ; ce plan ne couvre pas ce risque, hors périmètre par construction (doc 01 §7).
