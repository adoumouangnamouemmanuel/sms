# Guide d'import Excel (Phase 3.4)

Ce guide explique comment importer des élèves, des professeurs et des tuteurs
depuis un fichier Excel, et comment vérifier manuellement que tout fonctionne.

## 1. Récupérer le modèle

Deux options :

1. **Depuis l'application** - ouvrez le module **Élèves** (ou **Professeurs**),
   cliquez sur **Importer** puis sur **Télécharger le modèle (.xlsx)**.
2. **Depuis ce dépôt** - les fichiers prêts à l'emploi sont dans
   `docs/import-templates/` :

   | Fichier                     | Contenu                                                              |
   | --------------------------- | -------------------------------------------------------------------- |
   | `eleves_modele.xlsx`        | En-têtes + feuille « Mode d'emploi » + exemples (0 ligne de données) |
   | `professeurs_modele.xlsx`   | Idem pour les professeurs                                            |
   | `responsables_modele.xlsx`  | Idem pour les responsables (tuteurs)                                 |
   | `eleves_exemple.xlsx`       | **6 élèves valides, prêts à importer**                               |
   | `professeurs_exemple.xlsx`  | **4 professeurs valides, prêts à importer**                          |
   | `responsables_exemple.xlsx` | **4 responsables valides, prêts à importer**                         |
   | `eleves_avec_erreurs.xlsx`  | 6 lignes dont 3 en erreur (pour tester le rapport)                   |

## 2. Remplir le fichier

- **La première ligne (les en-têtes) ne doit pas être modifiée.**
- Ajoutez une ligne par personne à partir de la ligne 2 ; les lignes vides
  sont ignorées.
- Colonnes :

  | Colonne                                                      | Requis | Règle                                                                                                                                                 |
  | ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `Code`                                                       | Non    | Laissé vide, un code est généré automatiquement `{école}-{année}-{séquence}`. Un code explicite (ex. venu de l'ancien système) écrase le code généré. |
  | `Prénom`, `Nom`                                              | Oui    | Texte (max 120 caractères).                                                                                                                           |
  | `Sexe` (élèves)                                              | Non    | `M`, `F` ou `AUTRE` (ou `Masculin` / `Féminin`).                                                                                                      |
  | `Date de naissance` / `Date d'embauche`                      | Non    | `JJ/MM/AAAA` (ex. `14/03/2012`) ou `AAAA-MM-JJ`.                                                                                                      |
  | `Code élève` (responsables)                                  | Non    | Code de l'élève à lier automatiquement au responsable.                                                                                                |
  | `Nationalité`, `Spécialité`, `Téléphone`, `Email`, `Adresse` | Non    | Texte libre.                                                                                                                                          |

- **Codes** : un code utilisé deux fois dans le même fichier, ou déjà présent
  dans l'école, est refusé - les codes sont une identité durable et ne sont
  jamais réutilisés.

## 3. Importer

1. Cliquez sur **Importer** (barre du module Élèves, Professeurs ou Responsables).
2. **Analyser le fichier** - l'application lit le fichier, montre un aperçu
   (`valides` / `en erreur`) et **n'enregistre rien** à ce stade.
3. En cas d'erreurs, les messages s'affichent ligne par ligne. Cliquez sur
   **Télécharger les lignes en erreur (.csv)** pour corriger dans Excel
   (le CSV protège contre les formules - une cellule commençant par `=`, `+`,
   `-` ou `@` est neutralisée).
4. Saisissez un **identifiant d'import** (ex. `rentree-2026-09-01`) et cliquez
   sur **Confirmer l'import**.
5. Le **rapport** affiche : importés / déjà présents / en erreur.

## 4. Règle d'idempotence

Un même **identifiant d'import** ne peut être confirmé qu'une seule fois par
école. Si vous re-confirmez le même identifiant (par exemple après une erreur
réseau), rien de nouveau n'est importé et le rapport l'indique. Utilisez un
identifiant **différent** pour chaque fichier réellement nouveau.

## 5. Vérification manuelle (marche à suivre)

1. Lancez l'application (`pnpm --filter @edutrack/desktop run dev`) et
   connectez-vous en tant que directeur.
2. **Test 1 - import valide** : module **Élèves** → **Importer** →
   sélectionnez `docs/import-templates/eleves_exemple.xlsx` → **Analyser**.
   Attendu : **6 valides / 0 en erreur**. Identifiant `test-eleves-1` →
   **Confirmer**. Attendu au rapport : **6 importés**. Retour à la liste :
   6 élèves, dont les codes générés `NDS-DEMO-2026-001`…`005` et le code
   explicite `NDS-DEMO-2026-X00001`.
3. **Test 2 - idempotence** : re-faites l'import du même fichier avec le même
   identifiant `test-eleves-1`. Attendu au rapport : **« déjà confirmé »**,
   aucun doublon dans la liste.
4. **Test 3 - professeurs** : module **Professeurs** → **Importer** →
   `professeurs_exemple.xlsx` → analyser (4 valides) → identifiant
   `test-professeurs-1` → confirmer → 4 importés (la date `01/09/2015` devient
   `2015-09-01` sur le profil).
5. **Test 4 - responsables** : module **Responsables** → **Importer** →
   `responsables_exemple.xlsx` → analyser (4 valides) → identifiant
   `test-responsables-1` → confirmer → 4 importés. Les responsables sont
   créés et liés automatiquement aux élèves dont le `Code élève` figure dans
   le fichier (voir §7).
6. **Test 5 - erreurs** : **Élèves** → **Importer** →
   `eleves_avec_erreurs.xlsx` → analyser. Attendu : **3 en erreur** (Prénom
   manquant ligne 3, Sexe invalide ligne 4, Code dupliqué ligne 5).
   Téléchargez le CSV des lignes en erreur et vérifiez qu'il s'ouvre dans
   Excel. Saisissez l'identifiant `test-eleves-2` et cliquez sur
   **Confirmer l'import**. Attendu au rapport : **3 importés / 3 en erreur**
   - les lignes invalides ne sont jamais importées.
7. **Test 6 - sécurité** : vérifiez que seuls les 3 élèves valides du test 5
   sont dans la liste (aucune ligne en erreur), et que le compte d'un
   **enseignant** ne peut pas ouvrir la fenêtre d'import (bouton absent ou
   refus `403`).

## 6. Imports des classes (Phase 4.2)

Le module **Classes & programmes** propose trois nouveaux imports, accessibles
par le bouton **Importer** de chaque onglet :

- **Matières** (`matieres_modele.xlsx`) - colonnes `Code`, `Nom`, `Catégorie`,
  `Abréviation`. Le code (ex. `MATH`) est l'identité : un code déjà présent est
  signalé comme doublon possible mais jamais créé en double. Catégories
  acceptées : `LANGUES`, `SCIENCES`, `MATHEMATIQUES`, `SCIENCES_SOCIALES`,
  `ARTS`, `SPORTS`, `AUTRE`.
- **Classes** (`classes_modele.xlsx`) - colonnes `Année scolaire`, `Code
niveau`, `Code`, `Nom`, `Capacité`. L'année scolaire doit exister (sinon une
  ligne en erreur l'indique) ; le code de classe est unique par école et par
  année (`6E-A`, `3E-B`…).
- **Affectations** (`affectations_modele.xlsx`) - colonnes `Code classe`, `Code
matière`, `Coefficient`, `Obligatoire`, `Code professeur`. La classe et la
  matière sont résolues dans l'année active de l'école ; un professeur inconnu
  rejette la ligne. Le coefficient doit être ≥ 1 (max. 20).

Exemples de test rapide : **Classes** → **Importer** → `classes_exemple.xlsx`
→ analyser (2 valides) → identifiant `test-classes-1` → confirmer → 2
importées ; même logique pour `matieres_exemple.xlsx` et
`affectations_exemple.xlsx`. La règle d'idempotence du §4 s'applique aussi : le
même identifiant ne peut être confirmé qu'une seule fois.

## 7. Import des responsables (détail)

Le modèle `responsables_modele.xlsx` (bouton **Importer** du module
**Responsables**) comporte les colonnes :

| Colonne                         | Requis | Règle                                                                                                                                                               |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Prénom`, `Nom`                 | Oui    | Texte (max 120 caractères).                                                                                                                                         |
| `Téléphone`, `Email`, `Adresse` | Non    | Texte libre.                                                                                                                                                        |
| `Code élève`                    | Non    | Code d'un élève existant de l'école : lie automatiquement le responsable à cet élève. Un code inconnu rejette la ligne (l'élève doit être importé ou créé d'abord). |

> Le lien de parenté (`PERE`, `MERE`, `TUTEUR`, `AUTRE`) ne se règle pas à
> l'import : il se choisit dans l'application quand on lie le responsable à un
> élève (les responsables importés sont liés en `AUTRE` par défaut).

- **Liaison** : un responsable avec un `Code élève` valide est lié à l'élève
  correspondant au moment de la confirmation ; sans `Code élève`, le
  responsable est créé seul et peut être lié ensuite depuis la fiche élève
  (**Lier un responsable**).
- **Doublons** : deux responsables identiques (mêmes nom et prénom) restent
  distincts ; utilisez le lien par `Code élève` pour rattacher plusieurs
  élèves au même responsable.

**Vérification manuelle (Test 7)** : dans **Élèves**, notez le code d'un élève
(par ex. `NDS-DEMO-2026-001` après le test 1). Ouvrez
`responsables_exemple.xlsx`, remplacez la valeur de la colonne `Code élève`
d'une ligne par ce code, puis **Importer** → **Analyser** → **Confirmer** avec
l'identifiant `test-responsables-2`. Attendu : la ligne est valide et, sur la
fiche de l'élève, le responsable apparaît dans **Responsables liés** ; la fiche
responsable affiche l'élève dans **Élèves liés (fratrie)**.
