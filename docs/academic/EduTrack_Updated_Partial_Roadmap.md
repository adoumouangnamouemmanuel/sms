# EduTrack Africa --- Partial Updated Roadmap

**Scope:** Only phases affected by the Academic Configuration / Grade
Entry redesign\
**Purpose:** Structured implementation sequence after
reverting/reworking the existing single-result Phase 5\
**Canonical companion:** `Academic_Configuration_Grading_Redesign.md`

---

# Updated Phase 2 --- Authentication & Authorization

## Goal

Provide the secure identity and authorization foundation required before
permanent school configuration is exposed.

## Deliverables

- SchoolMaster authentication.
- Teacher authentication foundation.
- Role and permission enforcement.
- Trusted tenant context.
- Offline restart/sign-in behavior already required by V1.
- Audit actor identity foundation.

## Gate

Phase passes when an authenticated SchoolMaster can securely access the
configuration area and tenant isolation/permission tests pass.

---

# NEW Phase 3 --- School & Academic Configuration

## Goal

Allow a SchoolMaster to describe how the school is structured and how
academic results are produced **before teachers enter grades**.

This phase is now a hard dependency of grade entry.

---

## 3.1 Configuration foundation

Implement:

- configuration module boundaries;
- readiness/capability-gate model;
- versioning primitives;
- draft/publish/supersede lifecycle where applicable;
- shared validation/error patterns;
- configuration audit events;
- French-first UX foundation.

### Acceptance

- Configuration state is tenant-scoped.
- Backend can answer readiness for specific capabilities.
- Invalid configuration cannot be published.
- Configuration works offline.

---

## 3.2 School profile

Implement school identity configuration required operationally and later
by bulletins.

Include:

- official name;
- short name;
- logo reference;
- contact/address fields already approved by canonical V1;
- supported display language configuration where applicable.

Do not build the full bulletin designer here.

### Acceptance

SchoolMaster can create/update valid school profile through normal UI
without database edits.

---

## 3.3 Academic year and periods

Implement/reconcile:

- academic-year lifecycle;
- terms/trimesters/semesters;
- school-defined labels;
- ordering;
- dates;
- active academic context.

### Acceptance

A valid active academic year with ordered periods can be configured and
survives restart.

---

## 3.4 Levels and classrooms

Clarify and implement:

- level as academic-structure scope;
- classroom as operational cohort;
- classroom belongs to level;
- curriculum/policy inheritance from level rather than duplicated
  classroom configuration.

### Acceptance

SchoolMaster can configure levels and multiple classrooms per level
without duplicating academic policy.

---

## 3.5 Subjects and level curriculum

Implement:

- school-scoped subjects;
- level-subject applicability;
- required/optional status;
- coefficients;
- active/archive behavior;
- curriculum matrix UX.

### Acceptance

SchoolMaster can configure a complete level curriculum efficiently and
coefficients/applicability are backend validated.

---

## 3.6 Subject groups / sections

Implement:

- school-defined subject groups;
- subject membership;
- display order;
- `counts_for_admission` or equivalent approved flag if retained;
- intuitive assignment UX.

### Acceptance

Same subject can belong to different configured groups in different
schools without code changes.

---

## 3.7 Grading policy domain model

Implement the accepted neutral model:

- grading policy/version;
- assessment type definitions;
- repeatable occurrence rules;
- derived result definitions;
- final subject result definition;
- calculation graph validation;
- scale;
- precision;
- rounding;
- lifecycle/versioning.

Do **not** hard-code `DEV_1`, `DEV_2`, `DEV_3`, `EVAL`, or
school-specific terminology.

### Acceptance

Domain tests prove variable assessment counts and multiple
school-defined labels/formulas.

---

## 3.8 Grading policy builder UX

Implement:

- template selection;
- no implicit default;
- human-readable configuration forms;
- visual calculation flow;
- advanced calculation options;
- live sandbox;
- plain-language policy explanation;
- publish validation.

### Acceptance

A non-technical SchoolMaster can configure:

```text
2–6 repeatable assessments called "Devoir"
        ↓
derived mean called "Évaluation"
        +
Composition
        ↓
50/50 official "Moyenne"
```

without typing formula syntax.

---

## 3.9 Policy assignment and inheritance

Implement resolution:

```text
School default
    ↓
Level
    ↓
Level + Subject
```

UX:

- inherited-policy indicator;
- customize action;
- revert-to-inherited action;
- assignment matrix/overview.

### Acceptance

Automated tests prove deterministic resolution and no cross-school
leakage.

---

## 3.10 Appreciation configuration

Implement:

- appreciation scales;
- bands;
- thresholds;
- school-defined labels;
- versioning;
- overlap/gap validation;
- live preview.

Keep appreciation distinct from Mention/admission/promotion unless
separately approved.

### Acceptance

Boundary fixtures resolve appreciation deterministically and historical
finalized values cannot change due to later configuration edits.

---

## 3.11 Configuration onboarding wizard

Build guided onboarding using the same configuration
components/services.

Suggested flow:

1.  Établissement
2.  Année scolaire
3.  Périodes
4.  Niveaux & classes
5.  Matières & coefficients
6.  Groupes de matières
7.  Politique de notation
8.  Appréciations
9.  Vérification

### Acceptance

A new SchoolMaster can reach a grade-entry-ready school without
developer/database intervention.

---

## 3.12 Configuration dashboard and readiness gates

Show:

- completed configuration areas;
- warnings;
- blocking problems;
- capability readiness.

At minimum distinguish readiness for:

- people/enrolment operations;
- grade entry;
- grade submission;
- transcript calculation;
- PDF generation.

### Phase 3 Gate

Phase 3 passes when:

- onboarding works end-to-end;
- a valid grading policy is published;
- policy inheritance resolves correctly;
- appreciation is configured;
- grade-entry readiness can be determined;
- invalid/unconfigured scope is blocked;
- configuration survives restart;
- two-school isolation tests pass;
- no hard-coded three-devoir assumption exists.

---

# Updated Phase 4 --- People, Enrolment & Teaching Assignments

## Goal

Populate the configured academic structure with the people and
operational relationships required for grade entry.

## 4.1 Students and guardians

Implement/reuse:

- student records;
- guardian relationships;
- archive/deactivation;
- import where already scheduled.

## 4.2 Teachers

Implement/reuse:

- teacher records;
- account linkage when grade access is needed;
- archive/deactivation.

## 4.3 Student enrolment

Implement:

- academic-year/classroom enrolment;
- effective/history-preserving transitions;
- optional subject enrolment where applicable.

## 4.4 Teacher subject assignments

Assign teachers to class-subjects for the academic period/year according
to canonical design.

Do not put these assignments inside permanent academic configuration.

### Phase 4 Gate

For a configured school:

- students are enrolled;
- teachers are assigned;
- applicable student/subject roster resolves deterministically;
- permission tests pass;
- grade-entry contexts can be generated from configuration +
  operations.

---

# REBUILT Phase 5 --- Assessment, Grade Entry & Validation

## Goal

Allow teachers to administer configured assessment types, enter marks
efficiently, obtain deterministic computed results, submit academically
complete results, and allow SchoolMaster review/validation.

The previous single-result Phase 5 implementation must not be used as
the permanent data model.

---

## 5.0 Legacy Phase 5 rollback/reconciliation

Before new implementation:

- inspect existing migrations/schema/services/routes/UI/tests;
- identify reusable engineering patterns;
- revert/remove or migrate the single-result source-of-truth design;
- document migration/reconciliation;
- ensure no Phase 6 code depends on obsolete assumptions.

Preserve/reuse:

- authorization;
- tenant scoping;
- autosave patterns;
- optimistic concurrency;
- keyboard UX;
- submission lifecycle;
- audit;
- locking concepts.

### Gate

One clear target source of truth exists. No indefinite dual-write.

---

## 5.1 Grade context and policy resolution

Given teacher + year + term + class + subject:

- authorize teacher;
- resolve roster;
- resolve pinned published grading policy version;
- expose assessment definitions;
- expose current assessment instances;
- expose readiness.

### Acceptance

Unconfigured scope cannot enter grades and receives an actionable French
message.

---

## 5.2 Assessment instance management

Implement actual instances such as:

```text
Devoir 1
Devoir 2
Devoir 3
Composition
```

according to policy.

Support:

- repeatable creation;
- min/max enforcement;
- single assessment rules;
- ordering;
- safe lifecycle;
- audit where deletion/closure affects existing data.

### Acceptance

A policy allowing 2--6 Devoirs can create 2, 3, 4, 5, or 6 without
schema changes and cannot create a seventh.

---

## 5.3 Student assessment-result persistence

Implement per-student/per-assessment result persistence.

Support distinction between:

- graded;
- missing;
- absent;
- excused;
- not applicable;

while leaving unapproved calculation semantics behind explicit domain
decisions.

### Acceptance

Zero persists as zero and is never confused with missing.

---

## 5.4 Dynamic grade-entry grid

Build policy-driven grid.

Requirements:

- one editable column per actual assessment instance;
- read-only derived result columns;
- final subject result preview;
- keyboard-first entry;
- decimal normalization;
- autosave;
- persistence indicator;
- restart recovery;
- 60-student performance target.

### Acceptance

Adding Devoir 4 dynamically adds the corresponding grade column without
code/schema modification.

---

## 5.5 Shared calculation engine

Implement deterministic domain calculations:

- derived means;
- final weighted result;
- precision;
- configured rounding/truncation;
- range validation.

Use the same domain functions for frontend preview and backend
authoritative computation.

### Acceptance

Shared fixtures produce identical results in domain/API/UI paths.

---

## 5.6 Submission completeness engine

Determine whether the subject submission satisfies the policy.

Check:

- minimum assessment occurrences;
- required single assessments;
- student result completeness;
- valid states;
- successful derived calculations;
- other explicitly approved requirements.

Provide machine-readable blocking reasons.

### Acceptance

Teacher receives specific problems, not a generic incomplete error.

---

## 5.7 Teacher submission

Implement:

```text
DRAFT -> SUBMITTED
```

Requirements:

- backend completeness re-check;
- transaction;
- audit;
- lock teacher editing after submission;
- idempotent/retry-safe command semantics where appropriate.

---

## 5.8 SchoolMaster validation dashboard

Implement class/subject progress dashboard.

Show:

- teacher;
- policy;
- assessment coverage;
- student coverage;
- submission state;
- warnings.

Opening a submission exposes sufficient detail to review it.

---

## 5.9 Return and resubmission

Implement:

```text
SUBMITTED -> RETURNED -> SUBMITTED
```

Requirements:

- SchoolMaster reason required;
- teacher sees reason;
- editing re-enabled;
- audit;
- corrected data autosaves;
- completeness re-evaluated on resubmission.

---

## 5.10 Validation

Implement:

```text
SUBMITTED -> VALIDATED
```

Requirements:

- SchoolMaster only;
- backend authoritative;
- audit;
- validated grades locked from teacher edits;
- becomes eligible input for Phase 6.

---

## 5.11 Reopening

Implement:

```text
VALIDATED -> REOPENED -> SUBMITTED
```

Requirements:

- authorized SchoolMaster;
- mandatory reason;
- audit;
- respect downstream transcript/finalization locks;
- no silent recalculation of official records.

---

## 5.12 Phase 5 integration gate

End-to-end scenario:

1.  School has configured 2--6 Devoirs.
2.  Derived result label is `Évaluation`.
3.  Composition is required.
4.  Final result is 50/50.
5.  Teacher creates three Devoirs.
6.  Teacher enters marks.
7.  App restarts; marks remain.
8.  Computed Evaluation and final result are correct.
9.  Incomplete submission is blocked with precise explanation.
10. Teacher completes and submits.
11. SchoolMaster returns with reason.
12. Teacher corrects/resubmits.
13. SchoolMaster validates.
14. Teacher cannot modify validated data.
15. Reopening is audited and follows locking rules.
16. Another school can use different labels/rules without code changes.

### Phase 5 Gate

Phase passes only when the full workflow works offline, tenant isolation
passes, calculation fixtures pass, and the obsolete single-result
assumption is absent from the production workflow.

---

# Updated Phase 6 --- Official Results, Ranking & Bulletins

## Goal

Consume **validated Phase 5 data** and produce reproducible official
academic records.

Do not let PDF layout drive the grade-entry data model.

---

## 6.1 Official subject-result computation

Consume validated assessment data and pinned policy versions.

Persist official subject-result snapshots according to the accepted
transcript architecture.

No PDF computation from mutable draft grades.

---

## 6.2 Section and overall calculations

Implement approved:

- subject coefficients;
- section/group subtotals;
- overall average;
- admission average where configured;
- missing/non-applicable inclusion rules after explicit approval;
- deterministic fixed-point arithmetic.

---

## 6.3 Ranking and class statistics

Implement:

- competition ranking;
- deterministic display order for ties;
- subject/class averages;
- min/max where required;
- official ranking scope.

---

## 6.4 Appreciation resolution

Resolve configured appreciation using the pinned applicable
scale/version.

Persist/snapshot official display value where required for
reproducibility.

Do not conflate appreciation with Mention unless explicitly designed.

---

## 6.5 Transcript lifecycle

Retain/reconcile:

```text
DRAFT -> READY_FOR_REVIEW -> FINALIZED
             ^                  |
             |                  v
             +------------- REOPENED
```

Requirements:

- all required subject submissions validated;
- calculation succeeds;
- finalization freezes official values;
- reopening audited;
- recalculation explicit.

---

## 6.6 Annual result model

Design/implement only after term-result semantics are stable.

Annual records must be built from finalized term records, not re-entered
manually.

Exact annual policy and layout require explicit approval.

---

## 6.7 Bulletin configuration

Now implement presentation configuration consuming available official
snapshot fields.

Keep separate:

```text
Academic calculation configuration
        ≠
Bulletin presentation configuration
```

Configure:

- header;
- school identity;
- visible columns;
- labels;
- subject groups;
- rank/stat columns;
- appreciation;
- additional blocks;
- signatures/visa areas as approved;
- term versus annual presentation.

Do not create an unrestricted free-form layout engine unless explicitly
approved.

---

## 6.8 PDF generation

PDF consumes finalized persisted snapshots.

Requirements:

- deterministic/repeatable;
- French-first;
- school-configured layout;
- no recomputation from mutable grade-entry tables;
- printable on target environment;
- fixture/golden tests where practical.

### Phase 6 Gate

A configured pilot school can go from validated grades to finalized
official results and reproduce the same bulletin PDF without
mutable-data drift.

---

# Dependency Summary

```text
Phase 2
Authentication & Authorization
        ↓
Phase 3
School & Academic Configuration
        ↓
Phase 4
People, Enrolment & Teaching Assignments
        ↓
Phase 5
Assessment, Grade Entry & Validation
        ↓
Phase 6
Official Results, Ranking & Bulletins
```

The critical rule is:

> **Do not implement Phase 5 grade behavior before the relevant Phase 3
> configuration exists, and do not implement Phase 6 official output on
> top of an obsolete Phase 5 model.**
