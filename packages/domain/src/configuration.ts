import {
  CONFIG_LIFECYCLE_STATUSES,
  CONFIG_REQUIREMENTS,
  CONFIGURATION_AREAS,
  SCHOOL_CAPABILITIES,
  type CapabilityReadinessState,
  type ConfigLifecycleStatus,
  type ConfigRequirement,
  type ConfigurationAreaReadinessState,
  type ConfigurationReadinessState,
  type ConfigurationSnapshot,
  type SchoolCapability,
} from '@edutrack/shared';

/**
 * Phase 3.1 - pure configuration domain rules (roadmap §9.1).
 *
 * Deterministic functions only: the capability-gate readiness evaluator
 * (design §23) and the `DRAFT -> PUBLISHED -> SUPERSEDED` lifecycle
 * transitions (design §2.4). No database, no HTTP, no French - the API
 * service feeds live data in and maps verdicts to user-safe messages.
 */

/** Which requirements each capability needs, from design §23's gate list. */
const CAPABILITY_REQUIREMENTS: Record<SchoolCapability, readonly ConfigRequirement[]> = {
  CLASSROOM_MANAGEMENT: ['SCHOOL_PROFILE_COMPLETE', 'ACTIVE_ACADEMIC_YEAR', 'LEVELS_DEFINED'],
  CURRICULUM_CONFIGURATION: ['LEVELS_DEFINED', 'SUBJECTS_DEFINED'],
  GRADE_ENTRY: ['ACTIVE_ACADEMIC_YEAR', 'CURRICULUM_DEFINED', 'GRADING_POLICY_PUBLISHED'],
  GRADE_SUBMISSION: ['GRADING_POLICY_PUBLISHED'],
  GRADE_VALIDATION: ['GRADING_POLICY_PUBLISHED'],
  TRANSCRIPT_CALCULATION: [
    'GRADING_POLICY_PUBLISHED',
    'APPRECIATION_CONFIGURED',
    'VALIDATED_SUBMISSIONS',
  ],
  PDF_GENERATION: ['BULLETIN_CONFIGURED'],
};

/**
 * The gate ladder: each capability builds on the previous one, so a blocked
 * step always blocks everything above it (e.g. no published policy => no
 * transcript calculation => no PDF). Declaration order in SCHOOL_CAPABILITIES
 * is already dependency order, which keeps evaluation single-pass.
 */
const CAPABILITY_PREREQUISITES: Record<SchoolCapability, readonly SchoolCapability[]> = {
  CLASSROOM_MANAGEMENT: [],
  CURRICULUM_CONFIGURATION: ['CLASSROOM_MANAGEMENT'],
  GRADE_ENTRY: ['CURRICULUM_CONFIGURATION'],
  GRADE_SUBMISSION: ['GRADE_ENTRY'],
  GRADE_VALIDATION: ['GRADE_SUBMISSION'],
  TRANSCRIPT_CALCULATION: ['GRADE_VALIDATION'],
  PDF_GENERATION: ['TRANSCRIPT_CALCULATION'],
};

const READY = 'READY';
const NOT_READY = 'NOT_READY';

/** Whether a single configuration requirement is satisfied by the snapshot. */
export function configurationRequirementMet(
  snapshot: ConfigurationSnapshot,
  requirement: ConfigRequirement
): boolean {
  switch (requirement) {
    case 'SCHOOL_PROFILE_COMPLETE':
      return snapshot.schoolProfileComplete;
    case 'ACTIVE_ACADEMIC_YEAR':
      return snapshot.activeAcademicYear;
    case 'LEVELS_DEFINED':
      return snapshot.levelCount > 0;
    case 'SUBJECTS_DEFINED':
      return snapshot.subjectCount > 0;
    case 'CURRICULUM_DEFINED':
      return snapshot.curriculumClassCount > 0;
    case 'GRADING_POLICY_PUBLISHED':
      return snapshot.publishedGradingPolicies > 0;
    case 'APPRECIATION_CONFIGURED':
      return snapshot.appreciationConfigured;
    case 'VALIDATED_SUBMISSIONS':
      return snapshot.validatedSubmissions > 0;
    case 'BULLETIN_CONFIGURED':
      return snapshot.bulletinConfigured;
    default: {
      // Exhaustiveness guard: a new requirement added to the shared catalog
      // fails compilation here instead of silently evaluating to false.
      const exhaustive: never = requirement;
      return exhaustive;
    }
  }
}

/**
 * Evaluates every capability and Configuration area from live school facts.
 * A capability is READY only when all its requirements are met and all its
 * prerequisite capabilities are READY. Never throws and never returns
 * partial/NaN values - a zero-count or missing fact simply reads NOT_READY.
 */
export function evaluateConfigurationReadiness(
  snapshot: ConfigurationSnapshot
): ConfigurationReadinessState {
  const states = new Map<SchoolCapability, CapabilityReadinessState>();
  const capabilityStates: CapabilityReadinessState[] = [];

  for (const capability of SCHOOL_CAPABILITIES) {
    const missing = CAPABILITY_REQUIREMENTS[capability].filter(
      (requirement) => !configurationRequirementMet(snapshot, requirement)
    );
    const blockedBy = CAPABILITY_PREREQUISITES[capability].filter(
      (prerequisite) => states.get(prerequisite)?.status !== READY
    );
    const status = missing.length === 0 && blockedBy.length === 0 ? READY : NOT_READY;
    const state: CapabilityReadinessState = { capability, status, missing, blockedBy };

    states.set(capability, state);
    capabilityStates.push(state);
  }

  const isReady = (capability: SchoolCapability) => states.get(capability)?.status === READY;

  const areas: ConfigurationAreaReadinessState[] = [
    {
      area: 'SCHOOL_PROFILE',
      status: snapshot.schoolProfileComplete ? READY : NOT_READY,
    },
    {
      area: 'ACADEMIC_STRUCTURE',
      status:
        isReady('CLASSROOM_MANAGEMENT') && isReady('CURRICULUM_CONFIGURATION') ? READY : NOT_READY,
    },
    {
      area: 'GRADING_POLICY',
      status: snapshot.publishedGradingPolicies > 0 ? READY : NOT_READY,
    },
    {
      area: 'APPRECIATION',
      status: snapshot.appreciationConfigured ? READY : NOT_READY,
    },
    {
      area: 'BULLETIN',
      status: snapshot.bulletinConfigured ? READY : NOT_READY,
    },
  ];

  return {
    areas,
    capabilities: capabilityStates,
  };
}

// ---------------------------------------------------------------------------
// Versioned configuration lifecycle
// ---------------------------------------------------------------------------

/** Allowed transitions of the versioned-configuration lifecycle (design §2.4). */
const LIFECYCLE_TRANSITIONS: Record<ConfigLifecycleStatus, readonly ConfigLifecycleStatus[]> = {
  DRAFT: ['PUBLISHED', 'SUPERSEDED'],
  PUBLISHED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

export function canTransitionConfigLifecycle(
  from: ConfigLifecycleStatus,
  to: ConfigLifecycleStatus
): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** Thrown when a caller attempts a lifecycle transition the model forbids. */
export class ConfigLifecycleTransitionError extends Error {
  constructor(
    readonly from: ConfigLifecycleStatus,
    readonly to: ConfigLifecycleStatus
  ) {
    super(`Transition invalide de l'état ${from} vers ${to}.`);
    this.name = 'ConfigLifecycleTransitionError';
  }
}

/** Enforces the lifecycle; throws ConfigLifecycleTransitionError when invalid. */
export function assertConfigLifecycleTransition(
  from: ConfigLifecycleStatus,
  to: ConfigLifecycleStatus
): void {
  if (!canTransitionConfigLifecycle(from, to)) {
    throw new ConfigLifecycleTransitionError(from, to);
  }
}

export { CONFIG_LIFECYCLE_STATUSES, CONFIG_REQUIREMENTS, CONFIGURATION_AREAS, SCHOOL_CAPABILITIES };
