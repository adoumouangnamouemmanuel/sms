# EduTrack Africa --- Academic Configuration, Assessment, Grade Entry & Validation Redesign

**Status:** Architecture and product proposal for implementation\
**Scope:** Replaces the current single-result Phase 5 foundation and
defines the configuration foundation required before grade entry\
**Audience:** Coding agents and maintainers\
**Priority:** Correctness, configurability, usability, auditability,
offline operation, and preservation of official academic history

------------------------------------------------------------------------

## 1. Purpose

EduTrack must not encode the grading vocabulary or calculation method of
one school as universal application logic.

Real schools may:

-   administer a variable number of devoirs/continuous assessments;
-   call the derived average of those assessments `Moyenne des devoirs`,
    `Évaluation`, `Contrôle continu`, or another school-defined label;
-   use a Composition, Exam, Project, Oral, TP, or other assessment
    type;
-   combine derived and direct assessment results with school-specific
    weights;
-   use different grading policies by level and, when necessary, by
    subject within a level;
-   use different appreciation bands and terminology;
-   print different subsets of the underlying academic data on their
    bulletins.

Therefore EduTrack must model **neutral academic concepts** and let each
school configure terminology, rules, and presentation.

The core separation is:

> **What teachers record ≠ what EduTrack calculates ≠ what SchoolMaster
> validates ≠ what the bulletin prints.**

This proposal defines the first three. Bulletin/PDF presentation
consumes the official results later and must remain a separate concern.

------------------------------------------------------------------------

## 2. Mandatory architecture principles

### 2.1 No implicit grading scheme

There is no universal default grading scheme.

A school must explicitly publish a valid grading policy before grade
entry is enabled for the scope covered by that policy. Templates may
accelerate setup, but a template is only a starting configuration that
the SchoolMaster reviews and confirms.

Never silently assume:

-   three devoirs;
-   `/20` forever;
-   `Évaluation = moyenne des devoirs`;
-   `Moyenne des devoirs` as a universal label;
-   `50% continuous assessment + 50% composition`;
-   Composition exists;
-   a blank mark is zero;
-   a blank mark should be ignored;
-   every subject uses the same policy;
-   every level uses the same policy.

### 2.2 Neutral internal model, school-defined vocabulary

Do not create domain logic whose meaning depends on keys such as
`DEV_1`, `DEV_2`, `DEV_3`, `EVAL`, or `MOY_DEV`.

Use stable UUIDs and neutral entities such as:

-   grading policy;
-   assessment type;
-   assessment instance;
-   derived result definition;
-   final subject result definition;
-   student assessment result;
-   policy assignment;
-   appreciation scale.

Labels such as `Devoir`, `Évaluation`, `Moy. Dev.`, `Composition`, and
`Moyenne matière` are configuration.

### 2.3 Repeatable assessment types

A repeatable assessment type is configured once.

Example:

``` text
Assessment type: Devoir
Scale: /20
Occurrence rule: repeatable
Minimum occurrences: 2
Maximum occurrences: 6
```

Teachers then create actual assessment instances for a subject/term:

``` text
Devoir 1
Devoir 2
Devoir 3
Devoir 4
```

The number of instances is not hard-coded into the schema.

### 2.4 Versioned policies

Published academic policy is historical data.

Once a policy version is in use, editing it must never retroactively
change existing grades, calculations, validations, transcripts, or PDFs.

Policy lifecycle:

``` text
DRAFT -> PUBLISHED -> SUPERSEDED
```

Changes to an in-use policy create a new version.

Every grade/result/transcript calculation that depends on a policy must
be traceable to the exact policy version used.

### 2.5 Configuration and operations are different

**Configuration defines how the school works.**

Examples:

-   academic years and terms;
-   levels and classrooms;
-   subjects and coefficients;
-   subject groups/sections;
-   assessment types;
-   grading policies;
-   calculation rules;
-   appreciation bands;
-   validation requirements.

**Operations are activity inside that structure.**

Examples:

-   teacher assignments;
-   student enrolments;
-   creating Devoir 1;
-   entering Amina's mark;
-   submitting grades;
-   validating grades;
-   reopening a validated submission.

Do not mix these concepts merely because both concern academics.

------------------------------------------------------------------------

## 3. Configuration module

Configuration becomes a first-class permanent product area and is also
reused during onboarding.

### 3.1 Two entry experiences, one implementation

#### Initial onboarding

The first SchoolMaster is guided through the minimum configuration
needed to make EduTrack operational.

Suggested onboarding:

1.  Établissement
2.  Année scolaire
3.  Périodes académiques
4.  Niveaux & classes
5.  Matières & coefficients
6.  Groupes de matières
7.  Politique d'évaluation et de notation
8.  Appréciations & seuils
9.  Vérification

Do not require student/teacher operational data as part of academic
configuration.

#### Permanent Configuration area

After onboarding, the same underlying services/components remain
available from `Configuration`.

Do not build a separate onboarding-only configuration implementation.

------------------------------------------------------------------------

## 4. Academic structure configuration

The existing concepts remain useful, but ownership and UX should be
clarified.

### 4.1 Academic year

A school can create academic years with explicit status.

Recommended lifecycle:

``` text
DRAFT -> ACTIVE -> CLOSED
```

Only one active academic year unless an explicit future requirement
proves otherwise.

Historical years remain readable.

### 4.2 Academic periods

Terms/trimesters/semesters belong to an academic year.

Configuration should allow school-defined labels:

-   1er Trimestre;
-   2e Trimestre;
-   3e Trimestre;
-   Semestre 1;
-   Semestre 2;
-   other configured labels.

Period order is explicit.

Dates should be configurable but should not become the only determinant
of academic state.

### 4.3 Levels versus classrooms

A **level** defines academic structure.

Examples:

-   6ème
-   5ème
-   4ème
-   Terminale

A **classroom** is an operational cohort/container.

Examples:

-   6ème A
-   6ème B
-   Terminale C

Curriculum, coefficients, and grading policy should normally be defined
at level scope and inherited by classrooms.

Do not force the SchoolMaster to configure identical
coefficients/policies separately for 6ème A, 6ème B, and 6ème C.

### 4.4 Subjects

Subjects are school-scoped canonical records.

Examples are user-defined, not hard-coded.

Each subject may have:

-   full display name;
-   short name;
-   optional stable school code;
-   localization labels where supported;
-   active/archive state;
-   subject group/section membership.

### 4.5 Level curriculum and coefficients

A level-subject relationship determines whether a subject is taught at
that level and its coefficient.

The UX should support a matrix:

  Matière           6ème   5ème   4ème   3ème
  --------------- ------ ------ ------ ------
  Français             2      2      2      2
  Mathématiques        4      4      4      4
  Physique           ---    ---      3      3

A populated cell means applicable and displays the coefficient.

Editing a cell should support:

-   coefficient;
-   required/optional applicability;
-   active state.

Coefficients must be validated as positive values according to the
canonical domain rule selected for V1.

### 4.6 Subject groups / bulletin sections

Schools can group subjects differently.

Examples:

-   Matières littéraires;
-   Matières scientifiques;
-   Formation humaine.

A subject group's configuration includes:

-   school-defined name;
-   short label if useful;
-   display order;
-   whether the group counts toward an admission/promotion average when
    that concept is enabled.

Subject membership is school configuration and must not be inferred
permanently from a universal subject category.

UX should support drag-and-drop or simple assignment with immediate
preview.

------------------------------------------------------------------------

## 5. Configuration scope and inheritance

The configuration engine must be flexible without creating
administrative chaos.

### 5.1 Recommended resolution hierarchy

Use:

``` text
School default
    ↓
Level override
    ↓
Level + Subject override
```

Classroom-level grading-policy overrides are deliberately excluded from
normal V1 configuration unless later evidence proves them necessary.

### 5.2 Resolution rule

For a student/subject/term grade workflow:

1.  look for an active published `level + subject` policy assignment;
2.  otherwise use the level policy assignment;
3.  otherwise use the school default;
4.  if no valid published policy resolves, grade entry is blocked for
    that scope.

Never silently create a policy.

### 5.3 UX for inheritance

Do not expose technical terms like cascading configuration unless
necessary.

Show:

> **Utilise la politique de l'établissement**

or:

> **Utilise la politique du niveau : Terminale**

with:

`Personnaliser pour cette matière`

When customized:

> **Politique personnalisée --- Mathématiques · Terminale**

Provide:

`Revenir à la politique héritée`

Reverting inheritance must not delete historical policy versions already
used.

------------------------------------------------------------------------

## 6. Grading policy model

A grading policy is a versioned configuration describing how subject
results are produced.

A policy contains:

1.  scale;
2.  assessment type definitions;
3.  derived result definitions;
4.  final subject result definition;
5.  precision and rounding rules;
6.  completeness/submission requirements;
7.  missing/absence handling policy once approved;
8.  appreciation scale assignment where applicable;
9.  effective academic scope/version metadata.

### 6.1 Policy metadata

Conceptual fields:

``` text
grading_policy
  id
  school_id
  logical_policy_id
  version
  name
  status                 DRAFT | PUBLISHED | SUPERSEDED
  scale_max
  pass_threshold
  decimal_precision
  rounding_mode
  effective_academic_year_id
  created_by
  published_by
  published_at
  supersedes_policy_id
  created_at
  updated_at
  record_version
```

`logical_policy_id` groups versions of the same conceptual policy.

Exact schema naming may be adjusted to repository conventions, but
semantics must remain.

------------------------------------------------------------------------

## 7. Assessment types

An assessment type defines a category of marks teachers can record.

Examples are configuration, not enum values:

-   Devoir
-   Composition
-   Projet
-   Oral
-   TP
-   Interrogation

### 7.1 Assessment type properties

Conceptually:

``` text
assessment_type_definition
  id
  school_id
  grading_policy_id
  name
  short_name
  scale_max
  occurrence_mode       SINGLE | REPEATABLE
  min_occurrences
  max_occurrences
  required
  teacher_can_create_instances
  display_order
```

### 7.2 Repeatable example

``` text
Name: Devoir
Short name: Dev.
Scale: 20
Mode: REPEATABLE
Minimum: 2
Maximum: 6
Teacher can create instances: Yes
```

### 7.3 Single example

``` text
Name: Composition
Short name: Comp.
Scale: 20
Mode: SINGLE
Minimum: 1
Maximum: 1
Required: Yes
```

### 7.4 Rules

-   `min_occurrences >= 0`
-   `max_occurrences >= min_occurrences`
-   SINGLE implies a maximum of one.
-   A required single assessment must be structurally satisfiable.
-   Invalid definitions cannot be published.
-   Removing a definition already used requires a new policy version,
    never destructive mutation.

------------------------------------------------------------------------

## 8. Assessment instances

Assessment instances are operational records created for a particular
class-subject/term.

Example:

``` text
Configured type: Devoir

Actual instances:
- Devoir 1
- Devoir 2
- Devoir 3
```

Conceptual entity:

``` text
assessment_instance
  id
  school_id
  term_id
  class_subject_id
  assessment_type_definition_id
  sequence_number
  title
  assessment_date
  scale_max_snapshot
  created_by
  status
  created_at
  updated_at
  record_version
```

### 8.1 Instance rules

-   Must belong to the resolved policy version for the workflow.
-   Repeatable type cannot exceed configured maximum.
-   Teacher may create instances only when authorized by policy and
    assignment.
-   Sequence numbers are presentation/order, not domain identifiers.
-   Existing assessment instances with entered grades cannot be silently
    deleted.
-   Closing/removing an assessment after marks exist requires an
    explicit audited operation.

------------------------------------------------------------------------

## 9. Derived results

A derived result is calculated by EduTrack and cannot normally be
manually typed.

Examples:

``` text
Devoir 1
Devoir 2
Devoir 3
      ↓
Moyenne des devoirs
```

Another school may configure the same calculation but call it:

``` text
Évaluation
```

The label does not determine behavior.

### 9.1 Derived definition

Conceptually:

``` text
derived_result_definition
  id
  school_id
  grading_policy_id
  name
  short_name
  operation
  source_definition_ids / source_group
  precision
  rounding_mode
  display_order
```

### 9.2 V1 supported operations

Keep implementation controlled.

Required initial operation:

-   `MEAN`

Architecture may anticipate:

-   `WEIGHTED_MEAN`
-   `SUM`
-   `BEST_N`
-   `DROP_LOWEST_N`

but do not expose or implement speculative operations unless explicitly
included in the accepted implementation scope.

### 9.3 Example

``` text
Name: Évaluation
Source: all applicable Devoir instances
Operation: MEAN
Precision: 2
```

or:

``` text
Name: Moyenne des devoirs
Source: all applicable Devoir instances
Operation: MEAN
Precision: 2
```

Same engine.

------------------------------------------------------------------------

## 10. Final subject result

Every policy used for official grading must resolve to exactly one
official subject result.

Example:

``` text
Moyenne des devoirs   50%
Composition           50%
--------------------------
Moyenne matière       100%
```

Another:

``` text
Évaluation            40%
Composition           60%
--------------------------
Moyenne               100%
```

Another:

``` text
Note finale           100%
```

### 10.1 Definition

Conceptually:

``` text
subject_result_definition
  id
  school_id
  grading_policy_id
  name
  short_name
  precision
  rounding_mode
```

with child inputs:

``` text
subject_result_input
  id
  subject_result_definition_id
  source_definition_id
  weight
  display_order
```

### 10.2 Validation

Before publishing:

-   exactly one official subject result exists;
-   every input source exists;
-   no circular dependency exists;
-   weights are valid;
-   normalized weights total the required amount;
-   all dependency paths are calculable;
-   scale compatibility is validated;
-   rounding behavior is explicit.

------------------------------------------------------------------------

## 11. Calculation graph

Treat policy calculation as a directed acyclic graph, even if the V1 UX
does not use that terminology.

Example:

``` text
Devoir instances
      ↓
Moyenne des devoirs ── 50% ─┐
                              ├─> Moyenne matière
Composition ────────── 50% ──┘
```

The policy publisher must reject cycles.

Example invalid configuration:

``` text
A depends on B
B depends on A
```

Do not attempt to resolve it dynamically.

------------------------------------------------------------------------

## 12. Grade scale

Do not make `/20` a permanent architectural assumption.

A policy should explicitly define its scale.

Initial UX:

``` text
Barème principal       20
Note minimale          0
Note de réussite       10
Décimales              2
```

V1 may prioritize `/20` in templates for Chad, but the calculation
engine should avoid unnecessary assumptions that prevent `/10` or `/100`
later.

Persistence must continue using deterministic fixed-point representation
according to the project's canonical arithmetic rules.

------------------------------------------------------------------------

## 13. Rounding and precision

Rounding is academic policy.

Actual school evidence demonstrates that intermediate values may use
truncation rather than conventional half-up rounding.

Support at least the approved V1 modes:

-   `HALF_UP`
-   `TRUNCATE`

The configuration UX should place this under **Options avancées de
calcul** rather than making initial setup intimidating.

Example:

``` text
Précision              2 décimales
Méthode                Troncature
```

Calculation tests must cover exact boundary behavior.

Never use floating-point arithmetic for official persisted academic
results when deterministic fixed-point arithmetic is required by
canonical project rules.

------------------------------------------------------------------------

## 14. Appreciation configuration

Appreciation must not be hard-coded.

A school configures a scale mapping official averages to labels.

Example UX:

    À partir de Appréciation
  ------------- --------------
          16.00 Très bien
          14.00 Bien
          12.00 Assez bien
          10.00 Passable
           0.00 Insuffisant

### 14.1 Appreciation scale entity

Conceptually:

``` text
appreciation_scale
  id
  school_id
  name
  version
  status
  scale_max
```

``` text
appreciation_band
  id
  appreciation_scale_id
  lower_bound
  upper_bound
  label_fr
  label_ar
  label_en
  short_label
  display_order
```

Exact localization columns may follow the project's established i18n
strategy instead.

### 14.2 UX requirements

Provide:

-   add band;
-   remove unused draft band;
-   reorder if relevant;
-   edit threshold;
-   edit label;
-   live example preview;
-   immediate overlap/gap warnings;
-   validation before publishing.

Example preview:

> Moyenne : **14,37 / 20**\
> Appréciation : **Bien**

### 14.3 Integrity

A published appreciation scale used by official records is versioned.

Changes create a new version.

Do not mutate historical appreciation labels/thresholds in a way that
changes finalized records.

### 14.4 Open distinction

Do not automatically equate:

-   appreciation;
-   mention;
-   admission decision;
-   promotion decision.

These may be separate concepts and must remain separable until
explicitly designed.

------------------------------------------------------------------------

## 15. Missing, absent, excused and not-applicable results

This proposal establishes the data-model requirement but does **not**
invent final calculation semantics without approval.

A student assessment result must be capable of distinguishing at least:

``` text
GRADED
MISSING
ABSENT
EXCUSED
NOT_APPLICABLE
```

Potential additional states require explicit design.

Rules:

-   zero is a valid grade and never means missing;
-   blank UI state must not silently become zero;
-   the effect of ABSENT/EXCUSED on averages must be explicitly
    configured or decided by an approved ADR/domain decision;
-   grade submission completeness must use state, not merely
    null/non-null;
-   UI must communicate state clearly.

The coding agent must not invent calculation behavior for these states.

------------------------------------------------------------------------

## 16. Student assessment results

Conceptual entity:

``` text
student_assessment_result
  id
  school_id
  assessment_instance_id
  student_id
  state
  grade_fixed_point
  entered_by
  entered_at
  updated_at
  record_version
```

Constraints:

-   one active result per student + assessment instance;
-   tenant-scoped uniqueness;
-   grade range validated against assessment scale;
-   state/grade consistency enforced;
-   optimistic concurrency;
-   audit where required.

Derived results should normally be computed by domain services rather
than stored as editable grade rows.

Official snapshots later persist the exact values needed for
reproducibility.

------------------------------------------------------------------------

## 17. Grade-entry UX

The gradebook must be generated from the resolved policy and actual
assessment instances.

### 17.1 Teacher workflow

Teacher selects:

``` text
Academic year
Term
Class
Subject
```

EduTrack resolves the published policy.

The page shows:

-   policy name/version in unobtrusive detail;
-   assessment instances;
-   progress;
-   derived result previews;
-   submission readiness.

### 17.2 Dynamic assessment columns

If three Devoir instances currently exist:

  Élève     Dev 1   Dev 2   Dev 3   Évaluation   Composition   Moyenne
  ------- ------- ------- ------- ------------ ------------- ---------

Editable:

-   Dev 1
-   Dev 2
-   Dev 3
-   Composition

Read-only computed:

-   Évaluation
-   Moyenne

If a fourth devoir is created, the grid adds it.

Do not render six empty devoir columns simply because six is the
configured maximum.

### 17.3 Add assessment

For authorized repeatable assessment types:

`+ Ajouter un devoir`

Dialog:

``` text
Nouveau devoir

Nom             Devoir 4
Date            [optional/required according to design]
Barème          /20

[Annuler] [Créer]
```

At maximum occurrence:

> Le maximum de 6 devoirs autorisé par la politique de l'établissement
> est atteint.

### 17.4 Keyboard-first behavior

Preserve the good existing Phase 5 UX principles:

-   fast tab/enter navigation;
-   decimal comma and decimal point normalization where supported;
-   autosave;
-   visible persistence state;
-   no loss after restart;
-   row/cell validation;
-   accessible focus;
-   efficient entry for 60-student classes.

### 17.5 Computed preview

Derived values update immediately in the UI using the same shared domain
calculation functions used by the backend.

The backend remains authoritative.

Do not implement a second independent formula engine in React.

------------------------------------------------------------------------

## 18. Submission completeness

Completeness is policy-aware.

Example configuration:

``` text
Devoir
minimum occurrences: 2

Composition
required: yes
```

Teacher has only one Devoir instance:

> **1 devoir sur un minimum de 2**

Submission is blocked even if every cell in that one devoir is filled.

Teacher has three devoirs but a required student result is unresolved:

> **31 élèves sur 32 complets**

Submission remains blocked according to the approved missing-result
policy.

### 18.1 Readiness panel

Example:

``` text
État de la saisie

Devoirs                    ✓ 3 / minimum 2
Composition                ✓ 1 / 1
Élèves complets            ⚠ 31 / 32
Calcul des moyennes        ✓

1 problème empêche la soumission

[Voir le problème]

[Soumettre pour validation]  disabled
```

### 18.2 Validation errors must be actionable

Bad:

> Submission incomplete.

Good:

> Aucune note ni statut n'a été renseigné pour Adam Mahamat --- Devoir
> 3.

or:

> Deux devoirs minimum sont requis. Un seul devoir a été créé.

------------------------------------------------------------------------

## 19. Grade submission and SchoolMaster validation

Retain the proven lifecycle concept:

``` text
DRAFT -> SUBMITTED -> VALIDATED
   ^         |
   |         v
   +------ RETURNED

VALIDATED -> REOPENED -> SUBMITTED
```

### 19.1 DRAFT

Teacher can:

-   create permitted assessment instances;
-   enter/update marks;
-   resolve student result states;
-   inspect computed previews.

### 19.2 SUBMITTED

Teacher editing is locked.

SchoolMaster reviews:

-   structural compliance with policy;
-   assessment coverage;
-   student completeness;
-   computed subject results;
-   anomalies/warnings;
-   audit context.

### 19.3 RETURNED

SchoolMaster must provide a reason.

Example:

> Note de composition de Fatimé à vérifier.

Teacher regains editing access, corrects, and resubmits.

### 19.4 VALIDATED

Validated data is the authoritative input to later official transcript
computation.

Teacher cannot edit.

### 19.5 REOPENED

Only authorized SchoolMaster action.

Requirements:

-   explicit reason;
-   audit event;
-   clear warning if downstream calculations/transcripts are affected;
-   previously finalized transcript locking rules remain authoritative;
-   recalculation/re-finalization must be explicit.

Do not silently invalidate official records.

------------------------------------------------------------------------

## 20. Validation UX

SchoolMaster needs a dashboard, not a sequence of opaque submissions.

Example:

  Classe   Matière    Enseignant     Couverture État
  -------- ---------- ------------ ------------ -----------
  6ème A   Français   Mme X               32/32 Soumis
  6ème A   Maths      M. Y                31/32 Brouillon
  6ème A   Anglais    Mme Z               32/32 Validé

Opening a submission shows:

1.  policy summary;
2.  assessments administered;
3.  completeness;
4.  student results;
5.  computed derived values;
6.  warnings;
7.  history;
8.  actions.

Actions:

-   `Valider`
-   `Retourner à l'enseignant`

Return requires reason.

------------------------------------------------------------------------

## 21. Policy publishing UX

Configuration should be powerful but not feel like programming.

### 21.1 Template selection

Initial screen:

> **Comment votre établissement calcule-t-il les notes ?**

Templates may include:

-   Devoirs + Composition
-   Contrôle continu + Composition
-   Note finale uniquement
-   Personnalisé

These are editable starting points, not hard-coded domain types and not
automatic defaults.

### 21.2 Visual policy builder

Example:

``` text
┌───────────────┐
│    DEVOIRS    │
│   2 à 6 /20   │
└───────┬───────┘
        ↓
┌─────────────────────┐
│     ÉVALUATION      │
│   moyenne simple    │
└─────────┬───────────┘
          │ 50 %
          │
          ├──────────────┐
          │              │
          │      ┌───────▼──────┐
          │      │ COMPOSITION  │
          │      │     /20      │
          │      └───────┬──────┘
          │              │ 50 %
          ↓              ↓
      ┌────────────────────┐
      │      MOYENNE       │
      │        /20         │
      └────────────────────┘
```

Clicking a node opens human-readable settings.

Do not require SchoolMaster to type formulas.

### 21.3 Live sandbox

Provide `Tester cette politique`.

Example:

``` text
Dev 1          14
Dev 2          17
Dev 3          12
Composition    16

Évaluation     14.33
Moyenne        15.17
```

Changes to weights/rounding update preview immediately.

### 21.4 Plain-language explanation

Provide:

`Voir comment les notes sont calculées`

Generated deterministic explanation:

> Pour les niveaux concernés, les enseignants doivent enregistrer au
> moins 2 devoirs et peuvent en enregistrer jusqu'à 6. EduTrack calcule
> automatiquement leur moyenne, appelée « Évaluation ». Cette évaluation
> représente 50 % de la moyenne de la matière. La composition représente
> les 50 % restants.

This explanation is generated from configuration, not stored as
authoritative logic.

------------------------------------------------------------------------

## 22. Configuration validation

A policy cannot be published if invalid.

Validate at least:

-   missing official result definition;
-   invalid min/max occurrences;
-   impossible required assessment structure;
-   weight total mismatch;
-   missing source dependency;
-   circular calculation dependency;
-   incompatible scales where unsupported;
-   invalid grade range;
-   missing rounding/precision where required;
-   invalid policy assignment;
-   appreciation gaps/overlaps if full coverage is required;
-   duplicate conflicting scope assignments.

Errors must identify exactly what to fix.

------------------------------------------------------------------------

## 23. Configuration readiness and capability gates

Do not block the entire application because one unrelated configuration
section is incomplete.

Maintain readiness by capability.

Example dashboard:

``` text
Configuration générale       ✓ Prête
Structure académique         ✓ Prête
Notation                     ✓ Prête
Appréciations                ✓ Prête
Bulletin                     ⚠ À configurer
```

Suggested gates:

``` text
Create/manage classrooms
  -> academic structure ready

Configure curriculum
  -> levels + subjects ready

Enter grades
  -> academic period + curriculum + published grading policy ready

Submit grades
  -> grading policy + completeness rules ready

Validate grades
  -> submission valid

Calculate official transcripts
  -> all required subject submissions validated + calculation configuration valid

Generate PDF
  -> finalized official snapshot + bulletin configuration ready
```

The backend enforces every gate. UI gating alone is insufficient.

------------------------------------------------------------------------

## 24. Policy changes after grade entry begins

This is a critical integrity rule.

### 24.1 Draft policy not used

Can be freely edited.

### 24.2 Published but unused

Changes should normally create a new draft version for consistency,
although implementation may allow safe unpublish/edit only if no
dependent records exist and an approved rule explicitly permits it.

### 24.3 Used by assessment instances or grades

Immutable.

SchoolMaster chooses:

`Créer une nouvelle version`

The system must clearly explain when the new version becomes effective.

Do not migrate active grades to a different calculation policy
automatically.

### 24.4 Mid-term policy change

Do not invent automatic semantics.

A mid-term policy change can affect official results and requires an
explicit product/domain decision. Until that is designed, the safe rule
is:

> A policy version already used for a class-subject-term remains pinned
> for that workflow.

Future terms may resolve to the newer version.

------------------------------------------------------------------------

## 25. Migration from the current coded Phase 5

The existing single-result Phase 5 foundation must not constrain the new
design.

The implementation should be reverted/reworked before Phase 6 depends on
it.

### 25.1 Preserve concepts worth reusing

Reuse or reimplement the proven patterns:

-   role/assignment authorization;
-   tenant isolation;
-   optimistic concurrency;
-   autosave;
-   keyboard-first grid behavior;
-   submission lifecycle;
-   return reason;
-   validation;
-   reopening;
-   audit events;
-   finalized-transcript locking;
-   French-first errors;
-   restart persistence.

### 25.2 Do not preserve the wrong abstraction

Do not keep `submission_result` as the permanent source of truth merely
to avoid migration work.

The target source of truth must support assessment instances and
per-student assessment results.

If temporary migration compatibility is needed:

-   document it;
-   make reads/writes unambiguous;
-   establish one source of truth;
-   remove compatibility code at a defined gate.

Never dual-write indefinitely.

### 25.3 Data migration safety

If existing development/demo data is migrated:

-   create explicit fixtures/policies;
-   map legacy single results only to an explicitly configured
    single-result policy;
-   never infer that every school uses a single-result policy;
-   verify migration counts and values;
-   keep migration rollback/backup strategy appropriate to the
    development stage.

------------------------------------------------------------------------

## 26. Proposed service boundaries

Keep domain logic outside UI/routes/repositories.

Suggested modules/services:

``` text
configuration/
  AcademicStructureService
  GradingPolicyService
  PolicyAssignmentService
  AppreciationScaleService
  ConfigurationReadinessService

grades/
  AssessmentInstanceService
  GradeEntryService
  GradeSubmissionService
  GradeValidationService

domain/
  policyResolution
  policyValidation
  calculationGraph
  gradeParsing
  derivedResultCalculation
  subjectResultCalculation
  appreciationResolution
  submissionCompleteness
  lifecycleTransitions
```

Exact filenames should follow repository conventions.

------------------------------------------------------------------------

## 27. API behavior principles

Every endpoint:

-   derives school/tenant from trusted auth context;
-   checks permission server-side;
-   validates policy/version scope;
-   uses optimistic concurrency where records are mutable;
-   returns stable machine-readable errors plus French user-facing
    messages;
-   uses transactions for multi-record integrity;
-   is idempotent where command semantics require it.

Examples of likely endpoint families, not frozen route contracts:

``` text
/config/academic-years
/config/terms
/config/levels
/config/subjects
/config/curriculum
/config/grading-policies
/config/grading-policies/:id/publish
/config/policy-assignments
/config/appreciation-scales

/grades/context
/grades/assessment-instances
/grades/results
/grades/submissions
/grades/submissions/:id/submit
/grades/submissions/:id/validate
/grades/submissions/:id/return
/grades/submissions/:id/reopen
```

Do not create routes blindly if repository conventions already define
better contracts.

------------------------------------------------------------------------

## 28. Offline-first requirements

Every core workflow in this proposal must work without internet:

-   configuration;
-   policy publishing;
-   teacher assessment creation;
-   grade entry;
-   autosave;
-   submission;
-   SchoolMaster validation;
-   reopening;
-   derived calculation previews.

SQLite is authoritative for V1.

No feature in this proposal may require cloud connectivity.

------------------------------------------------------------------------

## 29. Audit requirements

Audit at minimum:

-   policy publication;
-   policy supersession;
-   policy assignment changes;
-   appreciation scale publication;
-   assessment deletion/closure after use;
-   grade submission;
-   return;
-   validation;
-   reopen;
-   privileged correction affecting validated data.

Audit data should include actor, school, target, action, timestamp, and
relevant reason/metadata.

Do not log secrets or unnecessary sensitive data.

------------------------------------------------------------------------

## 30. Testing requirements

### 30.1 Domain tests

Cover:

-   policy resolution hierarchy;
-   repeatable min/max rules;
-   calculation DAG cycle rejection;
-   mean calculation;
-   weight calculation;
-   scale boundaries;
-   rounding/truncation;
-   appreciation boundary values;
-   missing versus zero;
-   submission completeness;
-   lifecycle transitions;
-   policy immutability/versioning.

### 30.2 Repository tests

Cover:

-   two-school tenant isolation;
-   uniqueness;
-   optimistic concurrency;
-   FK integrity;
-   policy version relationships;
-   assessment-instance limits at service/domain boundary;
-   student-result state/grade consistency.

### 30.3 API integration tests

Cover:

-   role gates;
-   cross-school denial;
-   policy publication;
-   policy resolution;
-   teacher cannot create forbidden assessment;
-   teacher cannot exceed max occurrence;
-   incomplete submission rejection;
-   submit/return/resubmit/validate/reopen;
-   locked validated/finalized behavior;
-   French error envelope.

### 30.4 Component tests

Cover:

-   configuration builder;
-   inheritance display;
-   live calculation preview;
-   appreciation editor;
-   grade grid;
-   dynamic assessment columns;
-   autosave indicators;
-   keyboard navigation;
-   actionable validation errors;
-   readiness dashboard.

### 30.5 End-to-end scenarios

At minimum:

1.  New SchoolMaster completes onboarding.
2.  Creates `/20` policy with repeatable Devoir 2--6.
3.  Labels derived mean `Évaluation`.
4.  Configures Composition and 50/50 final result.
5.  Publishes policy and assigns it to a level.
6.  Configures appreciation bands.
7.  Teacher creates 3 devoirs.
8.  Teacher enters grades and restarts application.
9.  Grades persist.
10. Derived Evaluation/Moyenne values match shared fixtures.
11. Teacher attempts incomplete submission and receives actionable
    error.
12. Teacher completes data and submits.
13. SchoolMaster returns with reason.
14. Teacher corrects and resubmits.
15. SchoolMaster validates.
16. Teacher cannot edit validated submission.
17. SchoolMaster reopens with reason where allowed.
18. Policy version used by the workflow remains stable.
19. Another level/subject resolves an override correctly.
20. Two schools with different labels/formulas remain fully isolated.

------------------------------------------------------------------------

## 31. UX quality bar

The configuration experience must be suitable for a real SchoolMaster
who understands school rules but is not a software engineer.

Required principles:

-   use school vocabulary;
-   hide implementation terminology;
-   progressive disclosure;
-   advanced settings separated from common settings;
-   live previews;
-   templates as accelerators;
-   no implicit defaults;
-   explain consequences before publishing;
-   clearly distinguish inherited versus customized policy;
-   show readiness/progress;
-   actionable errors;
-   never require formula syntax for standard use;
-   preserve keyboard efficiency for grade entry;
-   French-first UI.

A flexible engine is not permission to create a complicated interface.

------------------------------------------------------------------------

## 32. Explicit non-goals for this implementation slice

Unless separately approved, do not add:

-   arbitrary user-written formula language;
-   classroom-level policy overrides;
-   cloud sync;
-   parent/student portals;
-   attendance module;
-   finance;
-   cryptographic signatures;
-   arbitrary drag-and-drop PDF designer;
-   AI-generated grading rules;
-   automatic promotion decisions;
-   unapproved semantics for absence/excused grades;
-   speculative assessment operations merely because the schema could
    support them.

------------------------------------------------------------------------

## 33. Decisions still requiring explicit approval

Do not silently decide these during implementation:

1.  Exact semantics of `ABSENT`.
2.  Exact semantics of `EXCUSED / DISPENSÉ`.
3.  Whether missing marks may ever be ignored in an average.
4.  Whether an assessment instance can be excluded from aggregation
    after marks exist.
5.  Whether weighted individual devoirs are required in V1.
6.  Whether appreciation applies to subject result, overall average, or
    both.
7.  Whether `Mention` is the same configuration concept as appreciation.
8.  Whether admission/promotion decisions are automatic or
    informational.
9.  Exact mid-term policy-change workflow.
10. Whether policy overrides beyond `school -> level -> level+subject`
    are needed.
11. Exact bulletin/PDF layout model --- to be designed with Phase 6.

When one of these blocks implementation, stop and request a focused
decision.

------------------------------------------------------------------------

## 34. Definition of Done

This redesign is complete only when:

-   no production grade workflow assumes a fixed number of devoirs;
-   no production calculation relies on school-specific labels as domain
    keys;
-   SchoolMaster can configure and publish a valid grading policy
    through friendly UX;
-   policies resolve through the approved inheritance hierarchy;
-   policy versions are immutable once used;
-   appreciation bands are configurable and versioned;
-   teacher can create permitted assessment instances dynamically;
-   grade entry is multi-assessment and keyboard efficient;
-   computed results use shared deterministic domain logic;
-   submission completeness is policy-aware;
-   SchoolMaster return/validate/reopen lifecycle works and is audited;
-   configuration readiness gates prevent invalid workflows;
-   all core behavior works offline;
-   tenant isolation is tested;
-   restart does not lose entered grades;
-   tests cover calculation and lifecycle boundaries;
-   no old single-result abstraction remains as an accidental permanent
    source of truth;
-   documentation and roadmap are updated to match the implemented
    domain model.

------------------------------------------------------------------------

## 35. Implementation instruction to coding agents

Before coding:

1.  Read `AGENTS.md`.
2.  Read the canonical `sms.md`.
3.  Read the current roadmap.
4.  Inspect current Phase 5 schemas, migrations, services, routes, UI,
    and tests.
5.  Identify exactly what must be reverted, migrated, reused, or
    replaced.
6.  Report conflicts between this accepted proposal and older canonical
    documents.
7.  Update canonical documentation/ADR as required before or alongside
    implementation.
8.  Implement vertically in the updated roadmap order.
9.  Do not jump to transcript/PDF work before the configuration and
    grade-validation gates pass.
10. Do not make any open decision listed above implicitly.

The objective is not to preserve the previous Phase 5 implementation.
The objective is to build the correct long-term academic foundation
while reusing the sound engineering patterns already proven.
