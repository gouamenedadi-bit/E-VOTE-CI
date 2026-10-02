# Maquettes des écrans — E-VOTE CI

Maquettes basse fidélité (texte/ASCII), dans l'ordre de construction du cahier des charges (§18). Palette de référence : orange/vert (rappel drapeau), blanc, bleu foncé/gris foncé pour le texte. Boutons larges, contrastes forts, pas d'animation.

## 1. Page d'accueil publique

```
┌──────────────────────────────────────────────────┐
│ [Logo E-VOTE CI]        ⚠ SIMULATION / DÉMONSTRATION │
├──────────────────────────────────────────────────┤
│  E-VOTE CI                                        │
│  Plateforme de simulation de vote électronique    │
│                                                    │
│  [ Comment ça fonctionne ]  [ Connexion démo ]     │
│  [ Voir les résultats publics ]                    │
│                                                    │
│  Scrutins de démonstration en cours : 2            │
├──────────────────────────────────────────────────┤
│ Footer : mentions légales · confidentialité ·      │
│ ce n'est pas un système officiel                   │
└──────────────────────────────────────────────────┘
```

## 2. Page de présentation et de fonctionnement

```
┌──────────────────────────────────────────────────┐
│ ← Accueil                                          │
│ Comment fonctionne la simulation ?                 │
│                                                    │
│ 1. Identification démo   2. Vote   3. Résultats    │
│                                                    │
│ [Bloc] Le secret du vote : comment c'est garanti   │
│ [Bloc] Pourquoi ce n'est pas un système officiel   │
│ [Bloc] Qui peut voir quoi (rôles)                  │
└──────────────────────────────────────────────────┘
```

## 3. Connexion de démonstration

```
┌──────────────────────────────────────────────────┐
│ Connexion électeur (démonstration)                │
│                                                    │
│ Numéro d'électeur fictif   [______________]        │
│ Code de vérification       [______________]        │
│                                                    │
│          [  Continuer  ]                           │
│                                                    │
│ ⓘ Données fictives uniquement — aucune donnée      │
│   réelle n'est demandée ou vérifiée.               │
└──────────────────────────────────────────────────┘
```

## 4. Vérification d'éligibilité fictive

```
┌──────────────────────────────────────────────────┐
│ Vérification en cours...                          │
│                                                    │
│ [✓] Numéro d'électeur reconnu (scénario démo)      │
│ [✓] Éligible pour : Présidentielle (simulation)    │
│ [ ] Éligible pour : Municipales (simulation) — non  │
│                                                    │
│          [ Accéder à mon espace ]                  │
└──────────────────────────────────────────────────┘
```

## 5. Tableau de bord électeur

```
┌──────────────────────────────────────────────────┐
│ Bonjour, Électeur démo #00123                      │
│                                                    │
│ Scrutins auxquels vous pouvez participer :         │
│  ┌────────────────────────────────┐                │
│  │ Présidentielle — Simulation      │ [ Voter ]     │
│  │ Ouvert jusqu'au 10/10 18h         │                │
│  └────────────────────────────────┘                │
│  ┌────────────────────────────────┐                │
│  │ Législatives — Circ. 12          │ Déjà voté ✓   │
│  └────────────────────────────────┘                │
└──────────────────────────────────────────────────┘
```

## 6. Page de sélection du scrutin

```
┌──────────────────────────────────────────────────┐
│ ← Retour                                           │
│ Scrutin sélectionné : Présidentielle (Simulation)  │
│                                                    │
│ Rappel des règles : un tour, majorité absolue       │
│ Second tour si nécessaire                           │
│                                                    │
│          [ Voir les candidats ]                     │
└──────────────────────────────────────────────────┘
```

## 7. Liste des candidats

```
┌──────────────────────────────────────────────────┐
│ Candidats — Présidentielle (Simulation)            │
│                                                    │
│ ┌───────┐  N°1  Nom Candidat A     ( ) Choisir      │
│ │ photo │       Parti A                            │
│ └───────┘                                           │
│ ┌───────┐  N°2  Nom Candidat B     ( ) Choisir      │
│ │ photo │       Parti B                            │
│ └───────┘                                           │
│           N°3  Vote blanc          ( ) Choisir      │
│                                                    │
│          [ Continuer ]                              │
└──────────────────────────────────────────────────┘
```
Règle d'affichage : même taille de photo, même police, même ordre pour tous les électeurs (ordre figé par `ballot_order`).

## 8. Page de confirmation

```
┌──────────────────────────────────────────────────┐
│ Vérifiez votre choix avant de valider              │
│                                                    │
│   Vous avez sélectionné :                          │
│   N°1 — Nom Candidat A — Parti A                   │
│                                                    │
│   [ Modifier mon choix ]      [ Confirmer le vote ] │
│                                                    │
│ ⚠ Après confirmation, ce choix ne pourra plus       │
│   être modifié.                                    │
└──────────────────────────────────────────────────┘
```

## 9. Confirmation de participation

```
┌──────────────────────────────────────────────────┐
│          ✓ Participation enregistrée               │
│                                                    │
│   Scrutin : Présidentielle (Simulation)            │
│   Enregistré le : 03/10/2026 14:32                 │
│                                                    │
│   Votre choix reste secret — il n'est affiché       │
│   nulle part, y compris sur cette page.             │
│                                                    │
│          [ Retour au tableau de bord ]              │
└──────────────────────────────────────────────────┘
```

## 10. Tableau de bord administrateur

```
┌──────────────────────────────────────────────────┐
│ Administration — E-VOTE CI          [MFA ✓] [⚙]     │
├──────────┬───────────────────────────────────────┤
│ Scrutins │ Scrutins en préparation : 1             │
│ Candidats│ Scrutins ouverts : 2                    │
│ Bureaux  │ Scrutins clôturés : 3                   │
│ Dépouil. │ Participation globale : 62 %             │
│ Résultats│ Bureaux actifs : 48 / 50                 │
│ Audit    │ ⚠ Alertes sécurité : 0                   │
│ Conformité│ ⚠ Anomalies à examiner : 1               │
│          │ Sauvegardes : OK (dernière: 02/10 03:00)│
└──────────┴───────────────────────────────────────┘
```

## 11. Gestion des élections

```
┌──────────────────────────────────────────────────┐
│ Élections                         [ + Nouveau ]     │
│                                                    │
│ Nom              Type        Statut      Actions   │
│ Présidentielle…  Présid.     Ouvert       [Gérer]   │
│ Législatives…    Législ.     Préparation  [Gérer]   │
├──────────────────────────────────────────────────┤
│ Fiche scrutin : nom, type, dates, circonscriptions,│
│ bureaux, règles (jsonb), documents, [Changer statut]│
└──────────────────────────────────────────────────┘
```

## 12. Gestion des candidats

```
┌──────────────────────────────────────────────────┐
│ Candidats — Présidentielle (Simulation)            │
│                                      [ + Ajouter ]  │
│ N° Nom          Parti    Statut       Actions       │
│ 1  Candidat A   Parti A  Validé       [Modifier]    │
│ 2  Candidat B   Parti B  En attente   [Valider][✗]  │
└──────────────────────────────────────────────────┘
```

## 13. Gestion des bureaux de vote

```
┌──────────────────────────────────────────────────┐
│ Bureaux de vote                     [ + Ajouter ]   │
│ Code   Nom              Commune      Actif          │
│ BV-001 École A           Abidjan      ✓              │
│ BV-002 École B           Abidjan      ✓              │
├──────────────────────────────────────────────────┤
│ Attribution agent : [Sélectionner un agent ▾]       │
└──────────────────────────────────────────────────┘
```

## 14. Module de dépouillement

```
┌──────────────────────────────────────────────────┐
│ Dépouillement — Présidentielle (Simulation)         │
│                                                    │
│ Statut : Clôturé → [ Lancer le dépouillement ]      │
│                                                    │
│ Bureau BV-001 : 312 bulletins / 318 participations  │
│   ⚠ Écart détecté — incident ouvert #INC-004         │
│ Bureau BV-002 : 290 bulletins / 290 participations ✓ │
│                                                    │
│ [ Générer les PV ]   [ Exporter CSV ]               │
│ [ Valider les résultats (contrôle à 2 niveaux) ]    │
└──────────────────────────────────────────────────┘
```

## 15. Page publique des résultats

```
┌──────────────────────────────────────────────────┐
│ Résultats — Simulation                              │
│ Filtres : [Type ▾] [Région ▾] [Dépt ▾] [Commune ▾]  │
│           [Circonscription ▾] [Bureau ▾]            │
│                                                    │
│ Statut : PROVISOIRE · Mise à jour : 03/10 15:00     │
│ Participation : 61,8 % (sur 1 204 318 inscrits démo)│
│                                                    │
│ Candidat A — Parti A        48,2 %  ████████░░      │
│ Candidat B — Parti B        45,1 %  ███████░░░      │
│ Blancs/Nuls                  6,7 %  █░░░░░░░░░       │
│                                                    │
│ [ Voir les PV publiables ]  [ Rapport de contrôle ] │
└──────────────────────────────────────────────────┘
```

## 16. Journal d'audit

```
┌──────────────────────────────────────────────────┐
│ Journal d'audit                   [Filtrer ▾]       │
│ Date       Acteur        Action                     │
│ 03/10 14:02 admin.dupont election.status_changed    │
│ 03/10 13:50 agent.koffi  participation.recorded      │
│ 03/10 12:10 système      integrity.chain_verified ✓  │
│                                                    │
│ ⓘ Aucun choix électoral n'apparaît dans ce journal. │
└──────────────────────────────────────────────────┘
```

## 17. Centre de conformité et de sécurité

```
┌──────────────────────────────────────────────────┐
│ Conformité & Sécurité                               │
│                                                    │
│ [Bloc] Registre des traitements de données          │
│ [Bloc] Incidents ouverts : 1   [Voir]                │
│ [Bloc] Dernière vérification de la chaîne d'intégrité│
│        03/10/2026 15:00 — OK                         │
│ [Bloc] Dernière sauvegarde testée : 02/10/2026       │
│ [Bloc] Registre des versions logicielles             │
└──────────────────────────────────────────────────┘
```

## Notes transverses d'accessibilité (toutes les pages)

- Taille de police minimale confortable, boutons ≥ 44px de hauteur.
- Contraste texte/fond conforme WCAG AA.
- Aucune information uniquement véhiculée par la couleur (icônes + texte).
- Navigation clavier complète, focus visible.
- Pas d'auto-rafraîchissement sans contrôle utilisateur sur les pages de vote.
