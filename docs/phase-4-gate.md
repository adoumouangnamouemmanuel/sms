# Phase 4 Gate — classes, curriculum and enrolment (roadmap §10.4)

This document maps every acceptance item of the Phase 4 gate (roadmap §10.4) to
its automated evidence. The gate is exercised end-to-end against the real API
on a migrated in-memory database, so a passing `pnpm run test` is the proof.

## How to run the gate

```bash
pnpm --filter @edutrack/api exec vitest run --config vitest.config.ts src/test/phase4.gate.test.ts
```

Or the whole suite (db + api + web) with:

```bash
pnpm run test
```

## Gate items and evidence

### 1. A SchoolMaster configures a realistic class and curriculum from a pilot fixture

- **Evidence:** `phase4.gate.test.ts → "configures the pilot 3E-A class and curriculum through the API"`.
- The test logs in as `directeur` (SchoolMaster role) and walks the full API
  path: creates the 8-subject Troisième catalogue (`POST /subjects`), creates
  the `3E-A` classroom for the current year (`POST /classrooms`), assigns the
  8 subject/coefficient/teacher entries (`POST /class-subjects`), and
  bulk-enrols 3 students (`POST /class-enrollments`). It asserts the created
  classroom context (`3E-A` / `3E` / `2026-2027`), capacity 40, and a roster of
  exactly 3 enrolled students.

### 2. Reimporting the same confirmed curriculum file is idempotent and does not duplicate assignments

- **Evidence:** `phase4.gate.test.ts → "reimporting the confirmed curriculum workbook is idempotent"`.
- The pilot curriculum is built as the downloadable `CLASS_SUBJECTS` Excel
  template (`Code classe`, `Code matière`, `Coefficient`, `Obligatoire`,
  `Code professeur`) and confirmed once: **8 imported / 0 skipped**. The same
  file is then previewed and confirmed again under a new import identifier:
  **0 imported / 8 skipped-existing**, the `class_subject` count stays at 8,
  and two `import_batch` rows remain for auditability (the `(school_id,
import_identifier)` unique index keeps each batch traceable).

### 3. Teacher assignment and optional-subject authorization tests pass

- **Evidence:**
  - `classes.routes.test.ts` — "assigns a subject with coefficient and teacher
    to a classroom", "rejects an already-assigned pair and an unknown teacher",
    "lists class-subjects with names and updates coefficient".
  - `phase4.gate.test.ts` — "authorizes optional-subject enrolment only for
    optional class-subjects": the optional `EPS` class-subject accepts explicit
    enrolment, while requesting a required class-subject through
    `POST /class-enrollments/optional-subjects` is rejected with
    `CLASS_SUBJECT_REQUIRED_LINK` (409). Required subjects are auto-enrolled on
    class join and cannot be requested explicitly.

### 4. Transfer and historical-enrolment tests pass

- **Evidence:**
  - `classes.routes.test.ts` — "transfers a student with effective date and
    reason while preserving history" (closed enrollment `TRANSFERRED` with
    `exitDate`, new enrollment `ACTIVE` from the effective date, both rows kept
    per student/year, `ENROLMENT_TRANSFER` audit event).
  - `phase4.gate.test.ts` — "transfers a pilot student with effective date and
    reason, preserving history" repeats the same assertions inside the pilot
    fixture, and confirms the source roster drops to 0.

### 5. The structure produces the exact subject rows expected on a reference bulletin

- **Evidence:** `phase4.gate.test.ts → "produces the exact reference-bulletin subject rows for 3E-A"`.
- After configuring the pilot fixture, `GET /class-subjects` returns the 8
  assignments; sorted by subject code (the bulletin display convention) they
  match the reference rows **exactly** — subject code, name, coefficient,
  required/optional flag and assigned teacher:

  | Code | Matière                           | Coef. | Obligatoire | Professeur      |
  | ---- | --------------------------------- | :---: | :---------: | --------------- |
  | ANG  | Anglais                           |   3   |     Oui     | Paul Djasrangar |
  | EC   | Éducation Civique et Morale       |   1   |     Oui     | Claudine Mbai   |
  | EPS  | Éducation Physique et Sportive    |   1   |     Non     | Claudine Mbai   |
  | FR   | Français                          |   4   |     Oui     | Jean Nguet      |
  | HG   | Histoire-Géographie               |   3   |     Oui     | Jean Nguet      |
  | MATH | Mathématiques                     |   4   |     Oui     | Mariam Abakar   |
  | PC   | Physique-Chimie                   |   2   |     Oui     | Paul Djasrangar |
  | SVT  | Sciences de la Vie et de la Terre |   2   |     Oui     | Mariam Abakar   |

## Also covered by the Phase 4.2 / 4.3 suites

- Curriculum copy with preview → confirm and idempotent re-confirm
  (`classes.routes.test.ts`, "previews a curriculum copy and confirms it
  idempotently").
- Class register export as an injection-safe CSV
  (`classes.routes.test.ts`, "exports a class register as an injection-safe
  CSV").
- SUBJECTS / CLASSROOMS / CLASS_SUBJECTS imports with template download,
  row-level French validation and duplicate skip
  (`imports.classes.test.ts`).
- Role enforcement: non-SchoolMaster roles cannot manage classes
  (`classes.routes.test.ts`, "rejects a non-school-master role from managing
  classes").
