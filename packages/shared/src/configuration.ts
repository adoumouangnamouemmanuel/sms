import { z } from 'zod';

/**
 * Phase 3.1 - configuration foundation (roadmap §9.1).
 *
 * Transport types shared by the API and the web UI for the permanent
 * Configuration area, the capability-gate readiness model and the
 * `DRAFT -> PUBLISHED -> SUPERSEDED` lifecycle primitives that the
 * versioned configuration tables (grading policy, appreciation) reuse.
 *
 * Canonical design: docs/academic/Academic_Configuration_Grading_Redesign.md
 * (§3 Configuration module, §22 Configuration validation, §23 Readiness gates).
 */

// ---------------------------------------------------------------------------
// Configuration areas (the permanent Configuration area's sections)
// ---------------------------------------------------------------------------

/** The sections of the permanent Configuration area (design §23 dashboard rows). */
export const CONFIGURATION_AREAS = [
  'SCHOOL_PROFILE',
  'ACADEMIC_STRUCTURE',
  'GRADING_POLICY',
  'APPRECIATION',
  'BULLETIN',
] as const;
export type ConfigurationArea = (typeof CONFIGURATION_AREAS)[number];

// ---------------------------------------------------------------------------
// Capabilities (what the school can actually do)
// ---------------------------------------------------------------------------

/**
 * Backend-enforced capability gates (design §23). A capability is READY only
 * when every requirement it lists is met and every prerequisite capability is
 * itself READY. The exact requirement mapping lives in the pure domain
 * evaluator (packages/domain/src/configuration.ts).
 */
export const SCHOOL_CAPABILITIES = [
  'CLASSROOM_MANAGEMENT',
  'CURRICULUM_CONFIGURATION',
  'GRADE_ENTRY',
  'GRADE_SUBMISSION',
  'GRADE_VALIDATION',
  'TRANSCRIPT_CALCULATION',
  'PDF_GENERATION',
] as const;
export type SchoolCapability = (typeof SCHOOL_CAPABILITIES)[number];

/** Machine-stable requirement codes; French text lives at the API/UI layer. */
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
export type ConfigRequirement = (typeof CONFIG_REQUIREMENTS)[number];

export const CONFIGURATION_READINESS_STATUSES = ['READY', 'NOT_READY'] as const;
export type ConfigurationReadinessStatus = (typeof CONFIGURATION_READINESS_STATUSES)[number];

// ---------------------------------------------------------------------------
// Versioning primitives
// ---------------------------------------------------------------------------

/**
 * Lifecycle shared by every versioned academic configuration (design §2.4).
 * The grading-policy and appreciation tables (roadmap §9.7/§9.10) reuse these
 * constants and the domain transition rules - never re-declare them.
 */
export const CONFIG_LIFECYCLE_STATUSES = ['DRAFT', 'PUBLISHED', 'SUPERSEDED'] as const;
export type ConfigLifecycleStatus = (typeof CONFIG_LIFECYCLE_STATUSES)[number];

// ---------------------------------------------------------------------------
// Academic year lifecycle (roadmap §9.3, design §4.1)
// ---------------------------------------------------------------------------

/**
 * Academic-year lifecycle (design §4.1). One year is ACTIVE per school;
 * historical years stay readable. Transitions are validated in the domain
 * (packages/domain/src/academic-year.ts): DRAFT -> ACTIVE -> CLOSED.
 */
export const ACADEMIC_YEAR_STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;
export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUSES)[number];

export const ACADEMIC_YEAR_STATUS_LABELS: Record<AcademicYearStatus, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'Active',
  CLOSED: 'Clôturée',
};

/** Draft terms never carry isCurrent: only the ACTIVE year's terms do. */
export const draftTermInputSchema = z.object({
  label: z.string().trim().min(2).max(80),
  termNumber: z.number().int().min(1).max(3),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const createAcademicYearRequestSchema = z.object({
  label: z.string().trim().min(4).max(40),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  terms: z.array(draftTermInputSchema).min(2).max(3),
});

export const academicYearStatusRequestSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED']),
});

export const academicYearWithTermsSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  label: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: z.enum(ACADEMIC_YEAR_STATUSES),
  isCurrent: z.boolean(),
  terms: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      termNumber: z.number().int(),
      startDate: z.string(),
      endDate: z.string(),
      isCurrent: z.boolean(),
    })
  ),
});

export const academicYearsResponseSchema = z.object({
  years: z.array(academicYearWithTermsSchema),
});

export type DraftTermInput = z.infer<typeof draftTermInputSchema>;
export type CreateAcademicYearRequest = z.infer<typeof createAcademicYearRequestSchema>;
export type AcademicYearStatusRequest = z.infer<typeof academicYearStatusRequestSchema>;
export type AcademicYearWithTerms = z.infer<typeof academicYearWithTermsSchema>;
export type AcademicYearsResponse = z.infer<typeof academicYearsResponseSchema>;

/**
 * Action vocabulary for configuration mutations. Every configuration section
 * (3.2 onwards) writes these actions through the existing audit repository so
 * the trail stays consistent. Reads are never audited.
 */
export const CONFIGURATION_AUDIT_ACTIONS = [
  'CONFIG_PROFILE_UPDATE',
  'CONFIG_YEAR_CREATE',
  'CONFIG_YEAR_ACTIVATE',
  'CONFIG_YEAR_CLOSE',
  'CONFIG_PERIOD_CREATE',
  'CONFIG_PERIOD_UPDATE',
  'CONFIG_LEVEL_CREATE',
  'CONFIG_LEVEL_UPDATE',
  'CONFIG_SUBJECT_CREATE',
  'CONFIG_SUBJECT_UPDATE',
  'CONFIG_GROUP_CREATE',
  'CONFIG_GROUP_UPDATE',
  'CONFIG_POLICY_CREATE',
  'CONFIG_POLICY_UPDATE',
  'CONFIG_POLICY_PUBLISH',
  'CONFIG_POLICY_SUPERSEDE',
  'CONFIG_APPRECIATION_UPDATE',
  'CONFIG_APPRECIATION_PUBLISH',
] as const;
export type ConfigurationAuditAction = (typeof CONFIGURATION_AUDIT_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Readiness snapshot and response contract
// ---------------------------------------------------------------------------

/**
 * The live configuration facts the readiness evaluator consumes. The API
 * service reads these from the existing tenant tables; the evaluator itself
 * is a pure function (never touches the database).
 */
export interface ConfigurationSnapshot {
  schoolProfileComplete: boolean;
  activeAcademicYear: boolean;
  levelCount: number;
  subjectCount: number;
  curriculumClassCount: number;
  /** Zero until roadmap §9.7 lands; grade entry then stays blocked. */
  publishedGradingPolicies: number;
  /** False until roadmap §9.10 lands. */
  appreciationConfigured: boolean;
  /** Zero until the rebuilt Phase 5 lands. */
  validatedSubmissions: number;
  /** False until the bulletin configuration exists. */
  bulletinConfigured: boolean;
}

/** One capability's readiness verdict, produced by the domain evaluator. */
export interface CapabilityReadinessState {
  capability: SchoolCapability;
  status: ConfigurationReadinessStatus;
  /** Requirement codes still unmet, in evaluation order. Empty when READY. */
  missing: ConfigRequirement[];
  /** Prerequisite capabilities still unmet. Empty when READY. */
  blockedBy: SchoolCapability[];
}

/** One Configuration-area verdict, derived from its capabilities. */
export interface ConfigurationAreaReadinessState {
  area: ConfigurationArea;
  status: ConfigurationReadinessStatus;
}

export interface ConfigurationReadinessState {
  areas: ConfigurationAreaReadinessState[];
  capabilities: CapabilityReadinessState[];
}

/** User-safe French labels (API-level defaults; the web UI maps codes to i18n). */
export const CONFIGURATION_AREA_LABELS: Record<ConfigurationArea, string> = {
  SCHOOL_PROFILE: 'Configuration générale',
  ACADEMIC_STRUCTURE: 'Structure académique',
  GRADING_POLICY: 'Notation',
  APPRECIATION: 'Appréciations',
  BULLETIN: 'Bulletin',
};

export const CONFIG_REQUIREMENT_LABELS: Record<ConfigRequirement, string> = {
  SCHOOL_PROFILE_COMPLETE: "Complétez le profil de l'école.",
  ACTIVE_ACADEMIC_YEAR: 'Définissez une année scolaire active.',
  LEVELS_DEFINED: 'Ajoutez au moins un niveau.',
  SUBJECTS_DEFINED: 'Ajoutez au moins une matière.',
  CURRICULUM_DEFINED: 'Affectez des matières aux classes.',
  GRADING_POLICY_PUBLISHED: 'Publiez une politique de notation.',
  APPRECIATION_CONFIGURED: 'Configurez les appréciations.',
  VALIDATED_SUBMISSIONS: 'Validez les soumissions de notes.',
  BULLETIN_CONFIGURED: 'Configurez le bulletin.',
};

/** API response contract for GET /configuration/readiness. */
export const configurationReadinessResponseSchema = z.object({
  areas: z.array(
    z.object({
      area: z.enum(CONFIGURATION_AREAS),
      status: z.enum(CONFIGURATION_READINESS_STATUSES),
      label: z.string(),
    })
  ),
  capabilities: z.array(
    z.object({
      capability: z.enum(SCHOOL_CAPABILITIES),
      status: z.enum(CONFIGURATION_READINESS_STATUSES),
      label: z.string(),
      missing: z.array(z.enum(CONFIG_REQUIREMENTS)),
      blockedBy: z.array(z.enum(SCHOOL_CAPABILITIES)),
    })
  ),
});

export type ConfigurationReadinessResponse = z.infer<typeof configurationReadinessResponseSchema>;
