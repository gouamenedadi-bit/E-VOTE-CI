# Cahier des charges fonctionnel — E-VOTE CI

## 1. Statut du projet

**E-VOTE CI est, à ce stade, une plateforme de démonstration et de simulation.**
Elle n'est ni homologuée, ni autorisée, ni destinée à produire un résultat électoral opposable. Aucune donnée réelle d'électeur, aucune carte d'électeur réelle et aucun accès au fichier électoral officiel ne sont utilisés. Cette distinction doit rester visible dans l'interface (bandeau "Simulation / Démonstration" sur chaque écran public) et dans le code (aucune fonctionnalité ne doit prétendre vérifier une identité réelle).

Trois conditions doivent être réunies avant toute évolution vers un usage officiel :
1. Autorisation de l'autorité électorale compétente (CEI) pour un dispositif de vote électronique.
2. Cadre légal et dispositif technique d'accès au fichier électoral officiel.
3. Audit de sécurité indépendant et homologation du protocole cryptographique de vote vérifiable.

Ce document ne couvre que le périmètre « simulation ».

## 2. Objectif

Fournir une plateforme web permettant de créer et d'exécuter des scrutins simulés (présidentiel, législatif, municipal, régional, sénatorial) avec des électeurs fictifs, afin de valider :
- le parcours de vote de bout en bout ;
- la séparation technique entre identité et bulletin (secret du vote) ;
- les contrôles anti-fraude (jeton unique, transactions atomiques, RLS) ;
- le dépouillement, la publication des résultats et les procès-verbaux ;
- les tableaux de bord d'administration et d'audit.

## 3. Types de scrutins pris en charge

| Type | Circonscription | Particularité |
|---|---|---|
| Présidentielle | Nationale | Un seul tour ou deux tours (second tour si aucun candidat > 50 %) |
| Législatives | Circonscription électorale (découpage par siège) | Plusieurs sièges par circonscription possibles |
| Municipales | Commune | Scrutin de liste |
| Régionales | Région | Scrutin de liste |
| Sénatoriales | Région / Département (grands électeurs) | Collège électoral restreint — à modéliser comme un `electorate_type` distinct |

Chaque type d'élection doit être paramétrable indépendamment (règles de candidature, mode de scrutin, seuils, nombre de tours) sans modification du code — voir `election_types` dans le schéma de base de données.

## 4. Fonctionnalités par domaine

### 4.1 Identification et éligibilité (démonstration)
- Saisie d'un numéro d'électeur **fictif**.
- Vérification de l'éligibilité par rapport au scrutin et à la circonscription (table `voter_eligibility`), jamais par le seul numéro.
- Code de vérification à usage unique (OTP) optionnel selon le scénario.
- Le numéro d'électeur n'est jamais traité comme une preuve d'identité suffisante : il doit être combiné à au moins un second facteur dans tout scénario qui simule un contrôle d'identité.
- Émission d'un **jeton de vote à usage unique** après validation de l'éligibilité — point de séparation technique entre identification et bulletin (voir doc 02, §3).

### 4.2 Interface de vote
- Liste des scrutins ouverts auxquels l'électeur de démonstration est éligible.
- Affichage des candidats/listes à égalité de traitement graphique, dans un ordre défini et documenté avant l'ouverture du scrutin (pas de randomisation non tracée).
- Sélection, écran de confirmation avant validation définitive, vote blanc si autorisé par les règles du scrutin.
- Reçu de participation : confirme uniquement que le vote a été enregistré, jamais le choix.

### 4.3 Sécurité et anti-fraude
- Séparation stricte identité / bulletin (doc 03, §2).
- Chiffrement des bulletins au repos.
- Jeton unique, contrainte d'unicité en base, transaction atomique à la consommation du jeton.
- Contrôle d'accès par rôle et par bureau (RLS).
- Journal d'audit immuable pour les actions administratives (jamais pour le contenu d'un bulletin).

### 4.4 Dépouillement et résultats
- Décompte automatique des bulletins valides/blancs/nuls, réconciliation avec le nombre de participations.
- Résultats agrégés par bureau, commune, département, région, et au niveau national.
- Procès-verbaux numériques, export PDF/CSV, archivage.
- Workflow de publication à plusieurs niveaux (brouillon → vérifié → publié), avec statut « provisoire » tant que la vérification indépendante n'est pas faite.
- Toute correction manuelle génère une entrée d'audit et requiert une autorisation explicite — jamais de modification silencieuse.

### 4.5 Administration
- Création/configuration des scrutins, bureaux de vote, circonscriptions, candidats.
- Gestion des rôles et des comptes de démonstration.
- Tableau de bord (scrutins par statut, participation, alertes, état des sauvegardes/audits).

### 4.6 Conformité et gouvernance
- Registre des traitements de données (finalités, durées de conservation).
- Procédure d'incident documentée.
- Registre des versions logicielles et procédure de validation avant mise en production.

## 5. Profils utilisateurs (résumé — détail doc 04)

| Rôle | Portée | Ne peut pas |
|---|---|---|
| Super administrateur | Toute la plateforme | Voir le choix individuel d'un électeur |
| Administrateur électoral | Scrutins qui lui sont attribués | Agir hors de son périmètre d'attribution |
| Agent de bureau de vote | Son bureau uniquement | Modifier un bulletin déjà déposé, agir sur un autre bureau |
| Observateur | Lecture : PV, résultats publiables, anomalies autorisées | Modifier quoi que ce soit |
| Électeur de démonstration | Ses scrutins éligibles | Voter deux fois, consulter son propre choix après coup, voir les choix d'autrui |

## 6. Exigences non fonctionnelles

- **Accessibilité** : conformité visée RGAA/WCAG AA, boutons larges, contrastes forts, pas d'animation distrayante, utilisable par des personnes âgées ou peu habituées au numérique.
- **Performance réseau** : interface fonctionnelle sur connexion lente (paquets de page légers, dégradation progressive, pas de dépendance bloquante à un CDN unique).
- **Résilience** : reprise de session interrompue sans double vote (le jeton non consommé reste valide jusqu'à expiration ; une tentative après consommation est rejetée de façon idempotente).
- **Disponibilité** : objectif de disponibilité défini par environnement (démo ≠ prod), sauvegardes testées.
- **Auditabilité** : toute action administrative et toute étape du cycle de vie d'un scrutin sont traçables sans exposer un choix individuel.

## 7. Hors périmètre explicite (phase simulation)

- Vérification d'identité réelle (biométrie, pièce d'identité, carte d'électeur réelle).
- Accès au fichier électoral officiel de la CEI.
- Valeur juridique des résultats produits.
- Protocole cryptographique de vote vérifiable de bout en bout de niveau production (la phase simulation documente le besoin mais ne l'implémente pas elle-même sans expertise externe — voir doc 02, §3.4).

## 8. Glossaire

- **Jeton de vote** : identifiant opaque à usage unique, non lié à l'identité après émission, permettant de déposer un bulletin pour un scrutin donné.
- **Bulletin** : contenu du vote, chiffré, stocké sans lien direct avec l'identité de l'électeur.
- **Registre de participation** : preuve qu'un électeur a voté, sans indication du choix.
- **PV (procès-verbal)** : document de synthèse des résultats d'un bureau, support de la vérification indépendante.
