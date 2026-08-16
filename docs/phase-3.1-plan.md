# Phase 3.1 — Configuration Foundation (Plan for Review)

**Branch:** `feature/phase-3-configuration`
**Roadmap:** §9.1 (Configuration foundation)
**Canonical design:** `docs/academic/Academic_Configuration_Grading_Redesign.md` (§2.1–2.5, §3, §22, §23)
**Status:** Proposal — implement directly after review

This phase builds the permanent, backend-enforced **configuration foundation** that every
later Phase 3 section (3.2–3.11) plugs into. It deliberately does **not** implement any
specific configuration screen yet — those are 3.2 (profile), 3.3 (year/periods), 3.4–3.6
(structure), 3.7–3.10 (grading policy/appreciation).

---

## 1. Scope (roadmap §9.1 checklist)

| Roadmap item | What we build here | Where |
|---|---|---|
| Configuration module boundaries + one permanent `Configuration` area, reused by onboarding | `CONFIGURATION` school module; permanent web area (readiness overview for V1); onboarding continues to reuse the same services later (3.11) | shared, db migration, web |
| Readiness/capability-gate model, backend-enforced | Capability catalog + pure readiness evaluator + `GET /configuration/readiness` + `assertCapability` enforcement helper | shared, domain, api |
| Versioning primitives + `DRAFT -> PUBLISHED -> SUPERSEDED` lifecycle | Lifecycle enum + pure transition validation (used by 9.7/9.10 tables) | shared, domain |
| Shared validation/error patterns + configuration audit events; French-first UX | `configuration` API module with typed errors; every future config mutation writes audit events via the existing audit repository (`CONFIG_*` actions) | api, docs |

**Explicitly out of scope (later Phase 3 sections):** school profile editor (3.2),
academic year/period lifecycle (3.3), levels/classrooms (3.4), subjects/curriculum (3.5),
subject groups (3.6), grading policy tables + builder (3.7/3.8), policy inheritance (3.9),
appreciation (3.10), onboarding wizard (3.11), full readiness dashboard UI (3.12).

---

## 2. Data model

**No new tables in 3.1.** Readiness is *computed* from live configuration data, never
cached (it must never go stale). The versioned tables (`grading_policy`,
`appreciation_scale`, …) land with their owning sections (9.7, 9.10) and will reuse the
lifecycle primitives defined here.

### 2.1 One schema change: `school_module_config.module_name` CHECK

The permanent `Configuration` area is registered as a first-class school module so the
UI nav and backend module gating treat it like every other module:

```sql
-- migration 0017 (hand-written, pattern of 0012_classes_module.sql)
-- CHECK widens to: ('SCHOOL_SETUP', 'ACADEMIC_STRUCTURE', 'STUDENTS',
--                   'TEACHERS', 'CLASSES', 'CONFIGURATION')
-- + backfill: INSERT one is_enabled=1 CONFIGURATION row per school missing it
```

Table rebuild pattern identical to migrations `0004`/`0005`/`0012`.

---

## 3. Shared catalog (`packages/shared/src/configuration.ts`)

```ts
// The permanent Configuration area sections (design §23 dashboard rows).
export const CONFIGURATION_AREAS = [
  'SCHOOL_PROFILE',    // Configuration générale
  'ACADEMIC_STRUCTURE',// Structure académique
  'GRADING_POLICY',    // Notation / Barème
  'APPRECIATION',      // Appréciations
  'BULLETIN',          // Bulletin (Phase 6 layout, config counted here)
] as const;

// Capabilities = what the school can DO. Gates from design §23.
export const SCHOOL_CAPABILITIES = [
  'CLASSROOM_MANAGEMENT',    // -> academic structure ready
  'CURRICULUM_CONFIGURATION',// -> levels + subjects ready
  'GRADE_ENTRY',             // -> period + curriculum + published policy
  'GRADE_SUBMISSION',        // -> policy + completeness rules ready
  'GRADE_VALIDATION',        // -> valid submission exists
  'TRANSCRIPT_CALCULATION',  // -> validated submissions + valid calculation config
  'PDF_GENERATION',          // -> finalized snapshot + bulletin config
] as const;

// Requirement codes: machine-stable, French text at the UI/API layer.
export const CONFIG_REQUIREMENTS = [
  'SCHOOL_PROFILE_COMPLETE',
  'ACTIVE_ACADEMIC_YEAR',
  'LEVELS_DEFINED',
  'SUBJECTS_DEFINED',
  'CURRICULUM_DEFINED',
  'GRADING_POLICY_PUBLISHED',
  'APPRECIATION_CONFIGURED',
  'VALIDATED_SUBMISSIONS',
  'BULLETIN_CONFIGURED',
] as const;

export const CONFIG_LIFECYCLE_STATUSES = ['DRAFT', 'PUBLISHED', 'SUPERSEDED'] as const;

export const CONFIGURATION_READINESS_SCHEMA = z.object({ ... }); // response contract
export const CONFIGURATION_MODULE_REQUEST_SCHEMA = z.object({ ... }); // future mutations
```

Also: `IMPLEMENTED_SCHOOL_MODULES` gains `'CONFIGURATION'` (shared/setup.ts), which flows
into the schema CHECK through the existing `schoolModuleNames` re-export.

---

## 4. Domain (`packages/domain/src/configuration.ts`) — pure, tested

```ts
export function evaluateConfigurationReadiness(
  snapshot: ConfigurationSnapshot
): ConfigurationReadiness
// Deterministic. A capability is READY only when every requirement it needs is met.
// Areas derive from capabilities:
//   SCHOOL_PROFILE  <- SCHOOL_PROFILE_COMPLETE
//   ACADEMIC_STRUCTURE <- CLASSROOM_MANAGEMENT + CURRICULUM_CONFIGURATION
//   GRADING_POLICY  <- GRADING_POLICY_PUBLISHED
//   APPRECIATION    <- APPRECIATION_CONFIGURED
//   BULLETIN        <- BULLETIN_CONFIGURED

export function canTransitionConfigLifecycle(from, to): boolean
// DRAFT->PUBLISHED ok; PUBLISHED->SUPERSEDED ok; DRAFT->SUPERSEDED ok (abandon);
// PUBLISHED->DRAFT / SUPERSEDED->* rejected.
export function assertConfigLifecycleTransition(from, to): void  // throws typed error
```

Snapshot shape (all booleans/counts the service can read from existing tables):

```ts
interface ConfigurationSnapshot {
  schoolProfileComplete: boolean;  // school.setup_status == 'COMPLETED' (or profile fields set)
  activeAcademicYear: boolean;     // academic_year.is_current == true
  levelCount: number;              // active, non-deleted class_level rows
  subjectCount: number;            // active, non-deleted subject rows
  curriculumClassCount: number;    // active class_subject rows in the current year
  publishedGradingPolicies: number;// 0 until 9.7 lands
  appreciationConfigured: boolean; // false until 9.10 lands
  validatedSubmissions: number;    // 0 until Phase 5 lands
  bulletinConfigured: boolean;     // false until 9.6/Phase 6 layout config lands
}
```

Capability → requirement mapping (from §23):

| Capability | Requirements |
|---|---|
| `CLASSROOM_MANAGEMENT` | SCHOOL_PROFILE_COMPLETE, ACTIVE_ACADEMIC_YEAR, LEVELS_DEFINED |
| `CURRICULUM_CONFIGURATION` | LEVELS_DEFINED, SUBJECTS_DEFINED |
| `GRADE_ENTRY` | ACTIVE_ACADEMIC_YEAR, CURRICULUM_DEFINED, GRADING_POLICY_PUBLISHED |
| `GRADE_SUBMISSION` | GRADING_POLICY_PUBLISHED |
| `GRADE_VALIDATION` | GRADING_POLICY_PUBLISHED |
| `TRANSCRIPT_CALCULATION` | GRADING_POLICY_PUBLISHED, APPRECIATION_CONFIGURED, VALIDATED_SUBMISSIONS |
| `PDF_GENERATION` | TRANSCRIPT_CALCULATION ready, BULLETIN_CONFIGURED |

---

## 5. API (`apps/api/src/modules/configuration/`)

```
GET /configuration/readiness        -> { success, data: ConfigurationReadiness, message }
```

- **Auth:** any authenticated user may read readiness (teachers need the blocked-message
  UX at grade entry; SchoolMaster sees the full dashboard). The `assertCapability`
  helper is exported for future service layers to gate mutations — backend only.
- **Service:** `ConfigurationService.getReadiness(actor)` builds the snapshot through a
  new `ConfigurationRepository` (data layer owns the queries: school setup status,
  current academic year, level/subject/class-subject counts) and runs the pure domain
  evaluator.
- **Errors:** `ConfigurationServiceError` (code/status/French message), following the
  existing `classes.errors.ts` / `audit.errors.ts` pattern.
- **Audit:** reads are not audited (noise). The action vocabulary for configuration
  mutations is fixed here so every later section writes consistent events:
  `CONFIG_PROFILE_UPDATE`, `CONFIG_YEAR_CREATE`, `CONFIG_POLICY_PUBLISH`, … — documented
  in this file, enforced from 3.2 onward.
- Registered in `apps/api/src/server.ts` like other modules.

---

## 6. Web (`apps/web/src/modules/configuration/`)

- **Nav:** `CONFIGURATION` in `MODULE_NAV_CONFIG` (gear icon), rendered by
  `MainAppShell` when the module is enabled — same mechanism as STUDENTS/CLASSES.
- **`ConfigurationModule.tsx`:** the permanent Configuration area for V1 is a clean
  **readiness overview** (the substance of 3.1, styled with the established teal design
  language):
  - Header + subtitle (French i18n).
  - 5 area cards (`Configuration générale`, `Structure académique`, `Notation`,
    `Appréciations`, `Bulletin`) with ✓ Prête / ⚠ À configurer status.
  - Capability rows with the unmet requirements listed in French (e.g.
    "Publiez une politique de notation").
  - Quick links to the surfaces that exist today (Profil de l'école → Settings,
    Structure académique → Classes) via the existing `onNavigate` mechanism; the rest
    are honest "à configurer" states, filled by 3.2–3.11.
- **`configurationApi.ts`:** typed client for `GET /configuration/readiness`.
- **i18n:** French keys under a `configuration.*` namespace; no hardcoded strings.

---

## 7. Tests

| Layer | Coverage |
|---|---|
| Domain (via API suite) | readiness matrix (every capability/area across full/partial/empty snapshots, zero-count edges); lifecycle transitions (valid + every rejected transition); no NaN/infinite |
| DB repository | snapshot queries return correct booleans/counts per school; tenant isolation (school B's data never affects school A) |
| API routes | 200 envelope shape; teacher and SchoolMaster both reachable; malformed query rejected; two-school isolation |
| Web component | French labels render; READY vs NOT_READY states; error state shows the French retry message; accessibility roles |

---

## 8. Decisions to confirm

1. **Readiness visible to all authenticated users** (teachers need blocked messages) —
   OK, or SchoolMaster-only for V1?
2. **`CONFIGURATION` as a school module** (nav-gated like CLASSES) vs. always-on core
   area? I recommend module (uniform mechanism, seed/migration backfills it on).
3. **Capability catalog names** (`CLASSROOM_MANAGEMENT`, …) — stable machine codes;
   French labels only at the UI layer. OK?
4. **`DRAFT -> SUPERSEDED` allowed** (abandoned draft) — OK?

---

## 9. Definition of done (this phase)

- [ ] `CONFIGURATION` module registered (schema + migration + seed backfill, idempotent).
- [ ] Readiness endpoint returns correct French-safe data for empty, partial and full
      configurations; two-school isolation proven by tests.
- [ ] Lifecycle primitives tested; no implicit grading assumptions anywhere.
- [ ] French-first UI for the Configuration area; existing modules untouched.
- [ ] Lint, typecheck, unit/integration tests and web build pass.
