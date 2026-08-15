# EduTrack Africa — Audit complet

**Date :** 15 août 2026 · **Branche :** `feature/phase-4-classes` · **Méthode :** revue manuelle du code (API, Web, DB, Desktop), scans ciblés (secrets, XSS, SQL brut, i18n, migrations), `pnpm audit`, build de production.

**Résumé :** le projet est globalement sain et bien durci (auth, CORS/capability, scoping locataire, audits, CI). **5 vulnérabilités de dépendances** (3 high / 1 moderate / 1 low — toutes à exploitabilité faible dans ce contexte localhost), 4 problèmes médiums (1 backend, 1 DB, 2 frontend), et plusieurs points bas/infos. Aucune fuite de secret, aucun sink XSS, aucune injection SQL via entrée utilisateur.

---

## 1. Synthèse par domaine

| Domaine             | État         | Commentaire                                                                                                                                          |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sécurité auth       | 🟢 Solide    | bcrypt cost 12, verrouillage 5 essais/15 min, hash factice anti-timing, refresh cookie httpOnly + SameSite=Strict, access token en mémoire seulement |
| Sécurité transport  | 🟢 Solide    | Sidecar loopback uniquement, allowlist d'origines + CORS manuel, header de capability vérifié sur chaque requête, CSP stricte du WebView             |
| Backend/API         | 🟢 Bon       | Validation zod systématique, scoping `school_id` partout, transactions, journal d'audit, import preview→confirm                                      |
| Base de données     | 🟢 Bon       | WAL activé, FK composites `(school_id, id)`, index uniques partiels, journal de migrations réparé et ordonné (13 entrées)                            |
| Frontend            | 🟡 Moyen     | Pas d'ErrorBoundary, un seul chunk JS de 690 kB, pas de timeout sur les fetch                                                                        |
| Dépendances         | 🔴 À traiter | 5 vulnérabilités (fastify, drizzle-orm, find-my-way)                                                                                                 |
| Docs / organisation | 🟢 Bon       | ADR 001–011, schema.md, guides d'import, gate docs, CHANGELOG à jour                                                                                 |
| CI                  | 🟢 Complet   | format, lint, typecheck, tests unitaires, build, gitleaks, smoke Playwright                                                                          |

---

## 2. Vulnérabilités de dépendances (`pnpm audit --prod`)

| #   | Sévérité    | Paquet                      | Installé | Fixé en                     | CVE / GHSA                                                                                | Impact réel                                                                                                                                                                                                             |
| --- | ----------- | --------------------------- | -------- | --------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | 🔴 high     | `drizzle-orm`               | 0.30.10  | ≥ 0.45.2 (ou 1.0.0-beta.20) | [GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9) / CVE-2026-39356 | Injection SQL via `escapeName()` sur les identifiants quotés. **Exploitabilité faible** : le code ne passe jamais d'identifiant contrôlé par l'utilisateur (toutes les tables/colonnes sont littérales dans les repos). |
| S2  | 🔴 high     | `fastify`                   | 4.29.1   | ≥ 5.7.2                     | [GHSA-jx2c-rxcm-jvmq](https://github.com/advisories/GHSA-jx2c-rxcm-jvmq)                  | Bypass de validation body via tab dans Content-Type. **Atténué** : chaque handler revalide avec `zod.safeParse` ; la ligne 4.x ne semble pas corrigée pour cet avis.                                                    |
| S3  | 🔴 high     | `find-my-way` (via fastify) | ≤ 9.6.0  | ≥ 9.7.0                     | [GHSA-c96f-x56v-gq3h](https://github.com/advisories/GHSA-c96f-x56v-gq3h)                  | DDoS HTTP/2. **Non exploitable** : HTTP/2 jamais activé. Résolu par S2.                                                                                                                                                 |
| S4  | 🟡 moderate | `fastify`                   | 4.29.1   | ≥ 5.8.3                     | [GHSA-444r-cwp2-x5xf](https://github.com/advisories/GHSA-444r-cwp2-x5xf)                  | `request.protocol`/`host` falsifiables. **Non utilisé** : l'app ne construit aucune URL depuis ces champs.                                                                                                              |
| S5  | 🟢 low      | `fastify`                   | 4.29.1   | ≥ 5.7.3                     | [GHSA-mrq3-vjjr-p77c](https://github.com/advisories/GHSA-mrq3-vjjr-p77c)                  | DoS mémoire via `sendWebStream`. Serveur localhost mono-utilisateur, aucune exposition réseau.                                                                                                                          |

**Fix proposé (S1–S5) :** une branche dédiée « dependabot/security » :

1. `fastify` → `^5.7.2` (l'usage est minimal : pas de plugins, CORS manuel, hooks `onRequest`/`onClose`, `reply.code().send()`. Risque de breaking changes faible — vérifier `FastifyServerOptions`, les types de `reply.header`, et le logger).
2. `drizzle-orm` → `^0.45.2` (saut majeur 0.30 → 0.45 : vérifier l'API `drizzle()`/better-sqlite3, `onConflictDoUpdate`, `sql\`\``, le migrator `drizzle-orm/better-sqlite3/migrator` — le code source est stable et sans plugins exotiques, mais tout le package db doit être re-vérifié).
3. Passer la porte complète : 266 tests + typecheck + lint + format + `build:sidecar` (la migration du journal et le bundling pkg doivent rester verts).

---

## 3. Findings backend / API

### B1 — 🟡 Médium : pas de `setErrorHandler` global

- **Où :** `apps/api/src/server.ts` (aucun `setErrorHandler`/`setNotFoundHandler`).
- **Problème :** une exception non attrapée sort du contrôleur → réponse 500 Fastify par défaut : enveloppe incohérente avec le reste (`{success:false,...}`) et stack trace exposée en dev.
- **Fix :** handler central qui journalise rouge (pino redact déjà configuré) et renvoie `{ success: false, error: { code: 'INTERNAL_ERROR', message: "Une erreur interne est survenue." } }` en 500. Effort : faible (≈ 30 lignes + 1 test).

### B2 — 🟢 Info : import/export dupliqué de `CAPABILITY_HEADER`

- **Où :** `apps/api/src/server.ts` lignes 19–20 (`export { CAPABILITY_HEADER } from './sidecar-contract.js'` suivi d'un `import` du même symbole).
- **Fix :** garder un seul `import` + un `export` explicite si l'export est utilisé par `index.ts`. Cosmétique.

### ✅ B3 — Vérifié bon

- Validation zod sur **tous** les bodies (login, refresh, reset, change, et tous les modules) ; erreurs de validation enveloppées avec champs.
- Scoping locataire : toutes les requêtes repos passent par `this.schoolId` (réparé aussi pour l'audit module et les compteurs de tests d'import — threads CodeRabbit résolus).
- Transactions drizzle pour les écritures multi-étapes ; `record_version` + 409 sur les entités classes.
- Audit trail append-only avec `actorUserId`, `correlationId`, métadonnées sérialisées.
- Import Excel : preview uniquement, rien n'est persisté avant confirmation ; doublons détectés par code/identité.
- Journalisation : pino avec redact des champs sensibles (`SENSITIVE_LOG_FIELDS`).
- Aucune injection SQL : le seul SQL brut est du `sql\`\`` drizzle paramétré (recordVersion + 1, concat), jamais d'entrée utilisateur.

---

## 4. Findings sécurité (hors dépendances)

### S6 — 🟡 Médium : token de capability exposé au WebView

- **Où :** `apps/desktop/src-tauri/src/lib.rs` (`capability_token` renvoyé par `deployment_status`, nécessaire au fonctionnement).
- **Problème :** une XSS dans le WebView obtiendrait le token + accès complet à l'API locale (lecture/écriture de la base). **Atténuations en place :** CSP `script-src 'self'`, aucun contenu distant chargé, aucun sink XSS trouvé (F5), token aléatoire 256 bits par lancement.
- **Fix (durcissement optionnel) :** limiter la durée de vie du token (rotation), ou exposer un token _per-window_ non réutilisable ; garder la CSP comme ceinture principale. Effort : faible-moyen.

### S7 — 🟢 Bas : pas de rate limiting sur `/auth/login`

- **Où :** `apps/api/src/modules/auth`.
- **Problème :** pas de throttling par IP. **Atténué :** verrouillage compte (5 essais / 15 min) + binding loopback uniquement.
- **Fix (optionnel) :** petit délai exponentiel côté service ou compteur global simple. Effort : faible.

### S8 — 🟢 Info : `access-token-secret` stocké en clair

- **Où :** `apps/desktop/src-tauri/src/lib.rs` → `%APPDATA%\EduTrack\access-token-secret`.
- **Note :** acceptable pour un desktop local mono-utilisateur (la base SQLite est elle-même en clair à côté). Sur Windows pas de chmod 0600 (fichier lisible par les processus du même utilisateur uniquement — cohérent avec le reste). Aucune action requise ; à documenter si multi-utilisateurs un jour.

### ✅ S9 — Vérifié bon

- bcrypt cost 12 + hash factice identique pour comptes/schools inconnus (anti-timing).
- Verrouillage 5 essais / 15 min avec `lockedUntil`.
- Refresh token : cookie `HttpOnly`, `SameSite=Strict`, `Path=/auth`, rotation à chaque refresh.
- Access token : **mémoire uniquement** côté Web (`authSession.ts`), jamais localStorage.
- `getListenOptions` refuse tout binding hors loopback ; `EDUTRACK_SIDECAR_TOKEN` requis en production (erreur au boot sinon).
- Check d'origine (allowlist) + en-tête de capability sur chaque requête (OPTIONS exempté à dessein, la vraie requête est vérifiée).
- Gitleaks en CI (`secret-scan.yml`), scan manuel : aucun secret en dur dans le repo (seuls des libellés i18n).
- `EDUTRACK_SEED_PASSWORD_HASH` validé : regex bcrypt complète + coût ≥ 12 sinon échec bruyant (fix du thread CodeRabbit déjà en place).

---

## 5. Findings base de données

### D1 — 🟡 Médium : aucun garde-fou contre la régression de l'ordre du journal de migrations

- **Où :** `packages/db/migrations/sqlite/meta/_journal.json` + `packages/db/src/test/database-foundation.test.ts`.
- **Contexte :** le bug d'ordre (`when` de 0008/0009/0010 < 0007) a fait sauter la création des tables classes sur les bases existantes — **réparé** (renumérotation 0013/0014/0015, journal strictement croissant, vérifié sur copie de ta base réelle).
- **Risque de récurrence :** rien n'empêche un futur `drizzle-kit generate` de réintroduire un `when` hors ordre.
- **Fix :** dans `database-foundation.test.ts`, ajouter une assertion : pour chaque entrée du journal, `when` strictement croissant ; + vérifier que le nombre de fichiers SQL == nombre d'entrées du journal. Effort : faible.

### D2 — 🟢 Bas : dossier `migrations/` orphelin à la racine

- **Où :** `migrations/sqlite/meta/` (vide, non tracké — reliquat d'un `drizzle-kit generate`).
- **Fix :** supprimer (`rmdir` récursif). Les vraies migrations vivent dans `packages/db/migrations/sqlite`. Effort : trivial.

### ✅ D3 — Vérifié bon

- WAL activé (`journal_mode = WAL` dans `client.ts` et `deployment.ts`).
- Journal : 13 entrées, `when` strictement croissant, aucun hors-ordre.
- FK composites `(school_id, id)` sur `refresh_session` et `audit_log` (fix cross-school des threads CodeRabbit).
- Index uniques partiels : une seule inscription ACTIVE par élève/année, un seul contact principal, `class_level (school_id, code)` ; `student_guardian` exclut les liens supprimés.
- Optimistic concurrency (`record_version`) sur classroom, subject, class-subject, enrollment, academic-year, level.

---

## 6. Findings frontend

### F1 — 🟡 Médium : aucun ErrorBoundary React

- **Où :** aucune occurrence de `ErrorBoundary`/`componentDidCatch` dans `apps/web/src`.
- **Problème :** un crash de rendu (donnée inattendue, bug) → **écran blanc** total, sans message ni récupération.
- **Fix :** ErrorBoundary racine (autour de l'app) + message français + bouton « Recharger » ; éventuellement un par module. Effort : faible.

### F2 — 🟡 Médium : un seul chunk JS de 690 kB (174 kB gzip) — pas de code-splitting

- **Où :** `apps/web/vite.config.ts` (aucun `manualChunks`, aucun `React.lazy`).
- **Preuve :** build de production → `index-*.js 690.23 kB │ gzip: 173.85 kB` + warning Vite « Some chunks are larger than 500 kB ». Les `import()` dynamiques de `dashboardApi.ts`/`teachersApi.ts` sont des **no-ops** (modules aussi importés statiquement).
- **Impact :** démarrage plus lent sur machines modestes ; `xlsx` (lourd) est chargé dès le départ alors qu'il ne sert qu'au module Imports.
- **Fix :** 1) `React.lazy` + `Suspense` par module (`students`, `teachers`, `classes`, `imports`, `dashboard`, `settings`) ; 2) `manualChunks` : `react`/`react-dom`, `i18next`, `xlsx` (chunk séparé chargé uniquement par Imports). Attendu : −30 à −50 % de JS initial. Effort : moyen.

### F3 — 🟢 Bas : fetch sans timeout / AbortController

- **Où :** les 8 clients API (`authApi.ts`, `classesApi.ts`, `dashboardApi.ts`, `importsApi.ts`, …) utilisent `fetch` nu.
- **Problème :** si le sidecar est bloqué (crash partiel, DB verrouillée), un spinner tourne indéfiniment ; certains écrans ont « Réessayer » mais pas tous.
- **Fix :** client partagé avec timeout (ex. 30 s) via `AbortController`, erreur « Service local indisponible » uniforme. Effort : faible.

### F4 — 🟢 Bas : clé i18n manquante

- **Où :** `apps/web/src/i18n.ts` — `common.date.placeholder` existe en `fr` (`JJ/MM/AAAA`) mais pas en `ar`/`en` (parité 379/378/378).
- **Fix :** ajouter la clé dans les deux blocs. Effort : trivial.
- **Note :** la parité générale est excellente (aucune autre clé manquante, aucun clé orpheline `ar`/`en`), et le bug « raw i18n key » (`classes.errors.generic`) est corrigé — scan : plus aucune clé littérale invalide dans `t()`.

### ✅ F5 — Vérifié bon

- Aucun sink XSS : zéro `dangerouslySetInnerHTML`, `innerHTML`, `eval` dans `src` (hors tests).
- Zéro `console.log` résiduel dans `src`.
- Access token en mémoire uniquement ; en-têtes `Authorization` + capability gérés proprement.
- Labels/aria sur les contrôles du shell (navigation, recherche, notifications, collapse).
- Formats de date `JJ/MM/AAAA` (locale fr/td) — cohérent ; conventions d'UI codifiées dans ADR-008.
- Problème de re-render sur le changement de filtre Niveau/Classe : corrigé (conformité react-hooks, loader réécrit sans `setState` dans `effect`).

---

## 7. Findings docs / organisation / CI

### O1 — 🟢 Bas : README ne documente pas les tests e2e

- **Où :** `README.md` vs `tests/e2e/web-smoke.spec.ts` + `pnpm test:e2e`.
- **Fix :** ajouter 2 lignes (commande + prérequis Playwright). Effort : trivial.

### O2 — 🟢 Info : `docs/import-templates/matieres_exemple.xlsx` modifié localement, non commité

- Fichier modifié (mtime 19:08) par une ouverture/sauvegarde Excel de ta part — inchangé et non commité de notre côté. À committer toi-même si voulu.

### ✅ O3 — Vérifié bon

- Docs : ADR 001–011, `docs/database/schema.md`, `docs/import-guidelines.md`, templates d'import (élèves, professeurs, responsables, classes, matières, affectations), `docs/phase-4-gate.md`, `docs/SchoolMS_Roadmap.md` (cases 10.1–10.4 cochées), CHANGELOG à jour.
- CI (`ci.yml`) : format → lint → typecheck → tests unitaires → build, puis job `playwright-smoke` avec Chromium. `secret-scan.yml` : gitleaks sur push/PR main+develop.
- Organisation : `packages/db/src/{repositories,schema,migrations,seeds}` + `src/test/` groupé — cohérent avec la restructuration documentée.

---

## 8. Plan d'action recommandé (par ordre)

1. **Court terme (1 session)** : B1 (error handler global), F1 (ErrorBoundary), F4 (clé i18n), D2 (dossier orphelin), D1 (test d'ordre du journal), O1 (README e2e). — Tout est faible effort, tests inclus.
2. **Moyen terme** : S1+S2+S3 (upgrade fastify 5.7.2 + drizzle 0.45.2) sur branche dédiée avec porte complète (266 tests + sidecar build). C'est le seul chantier à risque — à faire quand tu es prêt à vérifier le desktop.
3. **Moyen terme** : F2 (code-splitting) — gain perceptible au démarrage.
4. **Optionnel** : F3 (timeout fetch), S6 (rotation du token de capability), S7 (rate limiting login).

## 9. Méthode & commandes utilisées

- `pnpm audit --prod` (5 vulnérabilités, détail des ranges patched)
- Scans ripgrep : secrets, `dangerouslySetInnerHTML`/`innerHTML`/`eval`, SQL brut, TODO/FIXME, `console.*`, clés i18n (script node de parité fr/ar/en)
- Vérification du journal de migrations (ordre des `when`, 13 entrées)
- `pnpm exec vite build` (mesure des chunks, 6.2 s)
- Revue manuelle : `server.ts`, `auth.*`, `authSession.ts`, `auth.cookies.ts`, `lib.rs`, `tauri.conf.json`, `capabilities/default.json`, `seeds.ts`, `student.repository.ts`, CI workflows
