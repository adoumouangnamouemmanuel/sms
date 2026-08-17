import { z } from 'zod';

/**
 * Phase 3.7-3.9 - grading-policy configuration model (roadmap §9.7-§9.10).
 *
 * Transport types shared by the API and the web UI for:
 *  - versioned grading policies (DRAFT -> PUBLISHED -> SUPERSEDED),
 *  - assessment type definitions (SINGLE | REPEATABLE),
 *  - derived results (V1 operation MEAN),
 *  - the single official subject result with weighted inputs,
 *  - scope assignment and inheritance resolution,
 *  - versioned appreciation scales with bands.
 *
 * Canonical design: docs/academic/Academic_Configuration_Grading_Redesign.md
 * (§6-§14). There is NO implicit grading scheme: nothing here defaults to
 * `/20`, two devoirs, half-up rounding or any other school policy.
 */

// ---------------------------------------------------------------------------
// Enumerations (shared constants - never re-declared in db/domain/API)
// ---------------------------------------------------------------------------

export const ASSESSMENT_OCCURRENCE_MODES = ['SINGLE', 'REPEATABLE'] as const;
export type AssessmentOccurrenceMode = (typeof ASSESSMENT_OCCURRENCE_MODES)[number];

/** V1 supported derived-result operations (design §9.2). */
export const DERIVED_OPERATIONS = ['MEAN'] as const;
export type DerivedOperation = (typeof DERIVED_OPERATIONS)[number];

export const ROUNDING_MODES = ['HALF_UP', 'TRUNCATE'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

export const POLICY_SCOPE_TYPES = ['SCHOOL_DEFAULT', 'LEVEL', 'LEVEL_SUBJECT'] as const;
export type PolicyScopeType = (typeof POLICY_SCOPE_TYPES)[number];

// ---------------------------------------------------------------------------
// Policy document (what the builder edits and the API persists)
// ---------------------------------------------------------------------------

export const assessmentTypeInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  shortName: z.string().trim().min(1).max(20),
  /** Scale of a single mark for this type, in raw units (e.g. 20, 10). */
  scaleMax: z.number().int().min(1).max(100),
  occurrenceMode: z.enum(ASSESSMENT_OCCURRENCE_MODES),
  minOccurrences: z.number().int().min(0),
  maxOccurrences: z.number().int().min(1),
  required: z.boolean(),
  teacherCanCreateInstances: z.boolean(),
  displayOrder: z.number().int().min(0),
});

export const derivedResultInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  shortName: z.string().trim().min(1).max(20),
  operation: z.enum(DERIVED_OPERATIONS),
  /** Assessment-type definition ids this derived result averages. */
  sourceDefinitionIds: z.array(z.string()).min(1),
  precision: z.number().int().min(0).max(4),
  roundingMode: z.enum(ROUNDING_MODES),
  displayOrder: z.number().int().min(0),
});

export const subjectResultInputSchema = z.object({
  /** Source definition id: an assessment type or a derived result. */
  sourceDefinitionId: z.string(),
  /** Weight in hundredths of a percent (5000 = 50%). */
  weight: z.number().int().min(1),
  displayOrder: z.number().int().min(0),
});

export const subjectResultDefinitionInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  shortName: z.string().trim().min(1).max(20),
  precision: z.number().int().min(0).max(4),
  roundingMode: z.enum(ROUNDING_MODES),
  inputs: z.array(subjectResultInputSchema).min(1),
});

/** The complete, editable policy document. */
export const gradingPolicyConfigSchema = z.object({
  name: z.string().trim().min(2).max(80),
  /** Raw scale maximum (20, 10, 100, ...). */
  scaleMax: z.number().int().min(1).max(100),
  /** Pass threshold in hundredths (1000 = 10.00 on a /20 scale). */
  passThreshold: z.number().int().min(0),
  decimalPrecision: z.number().int().min(0).max(4),
  roundingMode: z.enum(ROUNDING_MODES),
  effectiveAcademicYearId: z.string().nullable(),
  assessmentTypes: z.array(assessmentTypeInputSchema).min(1),
  derivedResults: z.array(derivedResultInputSchema),
  subjectResult: subjectResultDefinitionInputSchema,
});

// ---------------------------------------------------------------------------
// Scope assignment (roadmap §9.9 - school default -> level -> level + subject)
// ---------------------------------------------------------------------------

/**
 * Discriminated on scopeType: SCHOOL_DEFAULT requires both ids null,
 * LEVEL requires a level, LEVEL_SUBJECT requires both. A malformed
 * combination is rejected at the API boundary instead of persisting
 * ambiguous rows (NULLs are distinct inside SQLite partial unique indexes).
 */
export const policyScopeAssignmentSchema = z.discriminatedUnion('scopeType', [
  z.object({
    scopeType: z.literal('SCHOOL_DEFAULT'),
    levelId: z.null(),
    subjectId: z.null(),
  }),
  z.object({
    scopeType: z.literal('LEVEL'),
    levelId: z.uuid(),
    subjectId: z.null(),
  }),
  z.object({
    scopeType: z.literal('LEVEL_SUBJECT'),
    levelId: z.uuid(),
    subjectId: z.uuid(),
  }),
]);

export const assignPolicyScopesRequestSchema = z.object({
  /** Replaces the policy's whole scope set atomically. */
  scopes: z.array(policyScopeAssignmentSchema).min(1),
});

// ---------------------------------------------------------------------------
// Appreciation configuration (roadmap §9.10, design §14)
// ---------------------------------------------------------------------------

export const appreciationBandInputSchema = z.object({
  id: z.string().optional(),
  /** Inclusive lower bound in hundredths (1600 = 16.00). */
  lowerBound: z.number().int().min(0),
  /** Inclusive upper bound in hundredths. */
  upperBound: z.number().int().min(0),
  labelFr: z.string().trim().min(1).max(60),
  labelAr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(60),
  shortLabel: z.string().trim().min(1).max(20),
  displayOrder: z.number().int().min(0),
});

export const appreciationScaleInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  /** Raw scale maximum the bands are expressed against (usually the policy scale). */
  scaleMax: z.number().int().min(1).max(100),
  bands: z.array(appreciationBandInputSchema).min(1),
});

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const gradingPolicySummarySchema = z.object({
  id: z.string(),
  logicalPolicyId: z.string(),
  version: z.number().int(),
  name: z.string(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']),
  scaleMax: z.number().int(),
  passThreshold: z.number().int(),
  decimalPrecision: z.number().int(),
  roundingMode: z.enum(ROUNDING_MODES),
  effectiveAcademicYearId: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const gradingPolicyDetailSchema = gradingPolicySummarySchema.extend({
  assessmentTypes: z.array(assessmentTypeInputSchema),
  derivedResults: z.array(derivedResultInputSchema),
  subjectResult: subjectResultDefinitionInputSchema,
});

export const policyScopeViewSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  scopeType: z.enum(POLICY_SCOPE_TYPES),
  levelId: z.string().nullable(),
  subjectId: z.string().nullable(),
});

export const gradingPoliciesResponseSchema = z.object({
  policies: z.array(gradingPolicySummarySchema),
  scopes: z.array(policyScopeViewSchema),
});

export const gradingPolicyDetailResponseSchema = z.object({
  policy: gradingPolicyDetailSchema,
  scopes: z.array(policyScopeViewSchema),
});

/** Query parameters for GET /grading-policies/resolved (validated at the API boundary). */
export const resolveGradingPolicyQuerySchema = z.object({
  levelId: z.uuid(),
  subjectId: z.uuid().nullish(),
});

export const resolvedPolicySchema = z.object({
  policyId: z.string(),
  name: z.string(),
  version: z.number().int(),
  /** Which scope actually matched: SCHOOL_DEFAULT, LEVEL or LEVEL_SUBJECT. */
  matchedScope: z.enum(POLICY_SCOPE_TYPES),
  policy: gradingPolicyDetailSchema,
});

export const resolvedPolicyResponseSchema = z.object({
  resolved: resolvedPolicySchema.nullable(),
  /** Human-readable French explanation of the resolution path (API layer). */
  explanation: z.string(),
});

export const appreciationBandViewSchema = z.object({
  id: z.string(),
  lowerBound: z.number().int(),
  upperBound: z.number().int(),
  labelFr: z.string(),
  labelAr: z.string(),
  labelEn: z.string(),
  shortLabel: z.string(),
  displayOrder: z.number().int(),
});

export const appreciationScaleViewSchema = z.object({
  id: z.string(),
  logicalScaleId: z.string(),
  version: z.number().int(),
  name: z.string(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']),
  scaleMax: z.number().int(),
  bands: z.array(appreciationBandViewSchema),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const appreciationScalesResponseSchema = z.object({
  scales: z.array(appreciationScaleViewSchema),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssessmentTypeInput = z.infer<typeof assessmentTypeInputSchema>;
export type DerivedResultInput = z.infer<typeof derivedResultInputSchema>;
export type SubjectResultInput = z.infer<typeof subjectResultInputSchema>;
export type SubjectResultDefinitionInput = z.infer<typeof subjectResultDefinitionInputSchema>;
export type GradingPolicyConfig = z.infer<typeof gradingPolicyConfigSchema>;
export type PolicyScopeAssignment = z.infer<typeof policyScopeAssignmentSchema>;
export type AssignPolicyScopesRequest = z.infer<typeof assignPolicyScopesRequestSchema>;
export type AppreciationBandInput = z.infer<typeof appreciationBandInputSchema>;
export type AppreciationScaleInput = z.infer<typeof appreciationScaleInputSchema>;
export type GradingPolicySummary = z.infer<typeof gradingPolicySummarySchema>;
export type GradingPolicyDetail = z.infer<typeof gradingPolicyDetailSchema>;
export type PolicyScopeView = z.infer<typeof policyScopeViewSchema>;
export type GradingPoliciesResponse = z.infer<typeof gradingPoliciesResponseSchema>;
export type GradingPolicyDetailResponse = z.infer<typeof gradingPolicyDetailResponseSchema>;
export type ResolvedPolicy = z.infer<typeof resolvedPolicySchema>;
export type ResolvedPolicyResponse = z.infer<typeof resolvedPolicyResponseSchema>;
export type AppreciationBandView = z.infer<typeof appreciationBandViewSchema>;
export type AppreciationScaleView = z.infer<typeof appreciationScaleViewSchema>;
export type AppreciationScalesResponse = z.infer<typeof appreciationScalesResponseSchema>;

// ---------------------------------------------------------------------------
// Templates (roadmap §9.8) - editable starting points, never automatic defaults
// ---------------------------------------------------------------------------

export interface GradingPolicyTemplate {
  key: 'DEVOIRS_COMPOSITION' | 'CONTROLE_CONTINU_COMPOSITION' | 'NOTE_FINALE' | 'CUSTOM';
  labelFr: string;
  descriptionFr: string;
  /** Builds an initial draft config. `scaleMax` comes from the school's choice. */
  build: (scaleMax: number, passThreshold: number) => GradingPolicyConfig;
}

/** Chadian secondary-school starting points (design §12 - a /20 template, not a law). */
export const GRADING_POLICY_TEMPLATES: GradingPolicyTemplate[] = [
  {
    key: 'DEVOIRS_COMPOSITION',
    labelFr: 'Devoirs + Composition',
    descriptionFr: 'Moyenne des devoirs (50 %) + Composition (50 %).',
    build: (scaleMax, passThreshold) => ({
      name: 'Devoirs + Composition',
      scaleMax,
      passThreshold,
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      effectiveAcademicYearId: null,
      assessmentTypes: [
        {
          id: 'tpl-devoir',
          name: 'Devoir',
          shortName: 'Dev.',
          scaleMax,
          occurrenceMode: 'REPEATABLE',
          minOccurrences: 2,
          maxOccurrences: 6,
          required: true,
          teacherCanCreateInstances: true,
          displayOrder: 1,
        },
        {
          id: 'tpl-composition',
          name: 'Composition',
          shortName: 'Comp.',
          scaleMax,
          occurrenceMode: 'SINGLE',
          minOccurrences: 1,
          maxOccurrences: 1,
          required: true,
          teacherCanCreateInstances: false,
          displayOrder: 2,
        },
      ],
      derivedResults: [
        {
          id: 'tpl-moyenne-devoirs',
          name: 'Moyenne des devoirs',
          shortName: 'Moy. Dev.',
          operation: 'MEAN',
          sourceDefinitionIds: ['tpl-devoir'],
          precision: 2,
          roundingMode: 'HALF_UP',
          displayOrder: 1,
        },
      ],
      subjectResult: {
        name: 'Moyenne matière',
        shortName: 'Moy. Mat.',
        precision: 2,
        roundingMode: 'HALF_UP',
        inputs: [
          { sourceDefinitionId: 'tpl-moyenne-devoirs', weight: 5000, displayOrder: 1 },
          { sourceDefinitionId: 'tpl-composition', weight: 5000, displayOrder: 2 },
        ],
      },
    }),
  },
  {
    key: 'CONTROLE_CONTINU_COMPOSITION',
    labelFr: 'Contrôle continu + Composition',
    descriptionFr: 'Évaluation continue (40 %) + Composition (60 %).',
    build: (scaleMax, passThreshold) => ({
      name: 'Contrôle continu + Composition',
      scaleMax,
      passThreshold,
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      effectiveAcademicYearId: null,
      assessmentTypes: [
        {
          id: 'tpl-evaluation',
          name: 'Évaluation',
          shortName: 'Éval.',
          scaleMax,
          occurrenceMode: 'REPEATABLE',
          minOccurrences: 2,
          maxOccurrences: 6,
          required: true,
          teacherCanCreateInstances: true,
          displayOrder: 1,
        },
        {
          id: 'tpl-composition',
          name: 'Composition',
          shortName: 'Comp.',
          scaleMax,
          occurrenceMode: 'SINGLE',
          minOccurrences: 1,
          maxOccurrences: 1,
          required: true,
          teacherCanCreateInstances: false,
          displayOrder: 2,
        },
      ],
      derivedResults: [
        {
          id: 'tpl-evaluation-moyenne',
          name: 'Évaluation',
          shortName: 'Éval.',
          operation: 'MEAN',
          sourceDefinitionIds: ['tpl-evaluation'],
          precision: 2,
          roundingMode: 'HALF_UP',
          displayOrder: 1,
        },
      ],
      subjectResult: {
        name: 'Moyenne matière',
        shortName: 'Moy. Mat.',
        precision: 2,
        roundingMode: 'HALF_UP',
        inputs: [
          { sourceDefinitionId: 'tpl-evaluation-moyenne', weight: 4000, displayOrder: 1 },
          { sourceDefinitionId: 'tpl-composition', weight: 6000, displayOrder: 2 },
        ],
      },
    }),
  },
  {
    key: 'NOTE_FINALE',
    labelFr: 'Note finale uniquement',
    descriptionFr: 'Une seule note officielle par matière.',
    build: (scaleMax, passThreshold) => ({
      name: 'Note finale',
      scaleMax,
      passThreshold,
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      effectiveAcademicYearId: null,
      assessmentTypes: [
        {
          id: 'tpl-note-finale',
          name: 'Note finale',
          shortName: 'Finale',
          scaleMax,
          occurrenceMode: 'SINGLE',
          minOccurrences: 1,
          maxOccurrences: 1,
          required: true,
          teacherCanCreateInstances: false,
          displayOrder: 1,
        },
      ],
      derivedResults: [],
      subjectResult: {
        name: 'Moyenne matière',
        shortName: 'Moy. Mat.',
        precision: 2,
        roundingMode: 'HALF_UP',
        inputs: [{ sourceDefinitionId: 'tpl-note-finale', weight: 10000, displayOrder: 1 }],
      },
    }),
  },
  {
    key: 'CUSTOM',
    labelFr: 'Personnalisé',
    descriptionFr: 'Commencez avec une politique vide et construisez votre propre calcul.',
    build: (scaleMax, passThreshold) => ({
      name: 'Politique personnalisée',
      scaleMax,
      passThreshold,
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      effectiveAcademicYearId: null,
      assessmentTypes: [
        {
          id: 'tpl-interrogation',
          name: 'Interrogation',
          shortName: 'Inter.',
          scaleMax,
          occurrenceMode: 'REPEATABLE',
          minOccurrences: 1,
          maxOccurrences: 10,
          required: false,
          teacherCanCreateInstances: true,
          displayOrder: 1,
        },
      ],
      derivedResults: [],
      subjectResult: {
        name: 'Moyenne matière',
        shortName: 'Moy. Mat.',
        precision: 2,
        roundingMode: 'HALF_UP',
        inputs: [{ sourceDefinitionId: 'tpl-interrogation', weight: 10000, displayOrder: 1 }],
      },
    }),
  },
];
