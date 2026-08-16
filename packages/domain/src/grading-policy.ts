import {
  ASSESSMENT_OCCURRENCE_MODES,
  CONFIG_LIFECYCLE_STATUSES,
  DERIVED_OPERATIONS,
  POLICY_SCOPE_TYPES,
  type AppreciationBandInput,
  type AppreciationScaleInput,
  type AssessmentTypeInput,
  type ConfigLifecycleStatus,
  type DerivedResultInput,
  type GradingPolicyConfig,
  type PolicyScopeAssignment,
  type PolicyScopeType,
  type RoundingMode,
  type SubjectResultDefinitionInput,
} from '@edutrack/shared';

/**
 * Phase 3.7-3.9 - pure grading-policy domain rules (roadmap §9.7-§9.10,
 * design §6-§14).
 *
 * Deterministic functions only: fixed-point arithmetic on integer hundredths,
 * policy/document validation, calculation-graph checks, scope resolution and
 * appreciation lookup. No database, no HTTP, no French, no floating point for
 * official values.
 */

// ---------------------------------------------------------------------------
// Policy lifecycle (design §2.4) - shared with all versioned configuration
// ---------------------------------------------------------------------------

const POLICY_TRANSITIONS: Record<ConfigLifecycleStatus, readonly ConfigLifecycleStatus[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

export function canTransitionPolicyStatus(
  from: ConfigLifecycleStatus,
  to: ConfigLifecycleStatus
): boolean {
  return POLICY_TRANSITIONS[from].includes(to);
}

/** Thrown when a policy status change violates the versioned lifecycle. */
export class PolicyTransitionError extends Error {
  constructor(
    readonly from: ConfigLifecycleStatus,
    readonly to: ConfigLifecycleStatus
  ) {
    super(`Transition de politique invalide ${from} -> ${to}.`);
    this.name = 'PolicyTransitionError';
  }
}

export function assertPolicyStatusTransition(
  from: ConfigLifecycleStatus,
  to: ConfigLifecycleStatus
): void {
  if (!canTransitionPolicyStatus(from, to)) {
    throw new PolicyTransitionError(from, to);
  }
}

// ---------------------------------------------------------------------------
// Fixed-point arithmetic (design §13) - integer hundredths only
// ---------------------------------------------------------------------------

/**
 * Rounds `numerator / denominator` (non-negative values) to `precision`
 * decimals and returns the value in integer hundredths.
 *
 * - precision >= 2: round at hundredths granularity (roundRaw on n/d).
 * - precision == 1: round to tenths, expressed in hundredths.
 * - precision == 0: round to whole units, expressed in hundredths.
 *
 * Deterministic integer math only - no floating point, no Math.round.
 */
export function roundToPrecision(
  numerator: number,
  denominator: number,
  precision: number,
  mode: RoundingMode
): number {
  if (denominator <= 0) {
    throw new Error('roundToPrecision requires a positive denominator.');
  }
  if (numerator < 0) {
    throw new Error('roundToPrecision does not support negative values.');
  }

  if (precision >= 2) {
    return roundRaw(numerator, denominator, mode);
  }
  if (precision === 1) {
    return roundRaw(numerator, denominator * 10, mode) * 10;
  }
  return roundRaw(numerator, denominator * 100, mode) * 100;
}

/** Rounding at hundredths granularity - the single rounding primitive. */
export function roundRaw(numerator: number, denominator: number, mode: RoundingMode): number {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;

  if (mode === 'TRUNCATE') {
    return quotient;
  }

  // HALF_UP: the exact .5 boundary rounds away from zero (non-negative => up).
  return 2 * remainder >= denominator ? quotient + 1 : quotient;
}

/**
 * MEAN of source marks (integer hundredths), rounded at the derived result's
 * own precision/rounding mode (design §9.1).
 */
export function derivedMean(
  marksHundredths: readonly number[],
  precision: number,
  roundingMode: RoundingMode
): number {
  if (marksHundredths.length === 0) {
    throw new Error('derivedMean requires at least one mark.');
  }

  const sum = marksHundredths.reduce((total, mark) => total + mark, 0);
  return roundToPrecision(sum, marksHundredths.length, precision, roundingMode);
}

/**
 * Weighted subject result. Weights are integer hundredths of a percent
 * (5000 = 50%). The denominator is the sum of weights (validation guarantees
 * 10000, but a non-zero divisor is what the math needs - never NaN/Infinity).
 */
export function weightedSubjectResult(
  sourceMarks: readonly { weight: number; markHundredths: number }[],
  precision: number,
  roundingMode: RoundingMode
): number {
  if (sourceMarks.length === 0) {
    throw new Error('weightedSubjectResult requires at least one source.');
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const source of sourceMarks) {
    weightedSum += source.weight * source.markHundredths;
    totalWeight += source.weight;
  }

  if (totalWeight <= 0) {
    throw new Error('weightedSubjectResult requires a positive total weight.');
  }

  return roundToPrecision(weightedSum, totalWeight, precision, roundingMode);
}

// ---------------------------------------------------------------------------
// Definition validation (design §7.4, §10.2)
// ---------------------------------------------------------------------------

export interface PolicyValidationIssue {
  code:
    | 'EMPTY_ASSESSMENT_TYPES'
    | 'INVALID_OCCURRENCE_RANGE'
    | 'SINGLE_OVER_OCCURRENCE'
    | 'MISSING_DERIVED_SOURCE'
    | 'MISSING_SUBJECT_SOURCE'
    | 'SUBJECT_RESULT_INPUTS_EMPTY'
    | 'WEIGHT_TOTAL'
    | 'CYCLE_DETECTED'
    | 'SCALE_MISMATCH'
    | 'PASS_THRESHOLD_ABOVE_SCALE'
    | 'PRECISION_OUT_OF_RANGE';
  /** Human-readable French message for the publish flow (UI maps codes to i18n). */
  message: string;
}

/** Validates one assessment type definition (design §7.4). */
export function validateAssessmentType(definition: AssessmentTypeInput): PolicyValidationIssue[] {
  const issues: PolicyValidationIssue[] = [];

  if (definition.minOccurrences < 0 || definition.maxOccurrences < definition.minOccurrences) {
    issues.push({
      code: 'INVALID_OCCURRENCE_RANGE',
      message: `« ${definition.name} » : le nombre d'occurrences minimum ne peut pas dépasser le maximum.`,
    });
  }

  if (definition.occurrenceMode === 'SINGLE' && definition.maxOccurrences > 1) {
    issues.push({
      code: 'SINGLE_OVER_OCCURRENCE',
      message: `« ${definition.name} » : un type unique ne peut avoir qu'une seule occurrence.`,
    });
  }

  if (definition.scaleMax <= 0) {
    issues.push({
      code: 'SCALE_MISMATCH',
      message: `« ${definition.name} » : le barème doit être supérieur à zéro.`,
    });
  }

  return issues;
}

/**
 * Validates the whole policy document for publication (design §10.2):
 * exactly one subject result, every source exists, weights total 100%,
 * the calculation graph is acyclic, scales are compatible and the pass
 * threshold sits inside the scale. Returns an empty array when publishable.
 */
export function validatePolicyForPublication(
  config: GradingPolicyConfig
): PolicyValidationIssue[] {
  const issues: PolicyValidationIssue[] = [];

  if (config.assessmentTypes.length === 0) {
    issues.push({
      code: 'EMPTY_ASSESSMENT_TYPES',
      message: 'Ajoutez au moins un type de note (devoir, composition, ...).',
    });
  }

  if (config.passThreshold > config.scaleMax * 100) {
    issues.push({
      code: 'PASS_THRESHOLD_ABOVE_SCALE',
      message: 'La note de réussite ne peut pas dépasser le barème maximum.',
    });
  }

  if (config.decimalPrecision < 0 || config.decimalPrecision > 4) {
    issues.push({
      code: 'PRECISION_OUT_OF_RANGE',
      message: 'La précision doit être comprise entre 0 et 4 décimales.',
    });
  }

  for (const definition of config.assessmentTypes) {
    issues.push(...validateAssessmentType(definition));
  }

  const allSourceIds = new Set(config.assessmentTypes.map((definition) => definition.id));
  const derivedIds = new Set<string>();

  for (const derived of config.derivedResults) {
    if (derived.id) {
      derivedIds.add(derived.id);
    }
    for (const sourceId of derived.sourceDefinitionIds) {
      if (!allSourceIds.has(sourceId)) {
        issues.push({
          code: 'MISSING_DERIVED_SOURCE',
          message: `« ${derived.name} » référence une source inexistante.`,
        });
      }
    }
  }

  const subject = config.subjectResult;

  if (subject.inputs.length === 0) {
    issues.push({
      code: 'SUBJECT_RESULT_INPUTS_EMPTY',
      message: 'Le résultat final doit avoir au moins une source.',
    });
  }

  let totalWeight = 0;
  for (const input of subject.inputs) {
    if (!allSourceIds.has(input.sourceDefinitionId) && !derivedIds.has(input.sourceDefinitionId)) {
      issues.push({
        code: 'MISSING_SUBJECT_SOURCE',
        message: `Le résultat final référence une source inexistante.`,
      });
    }
    totalWeight += input.weight;
  }

  if (totalWeight !== 10000) {
    issues.push({
      code: 'WEIGHT_TOTAL',
      message: `Les pondérations doivent totaliser 100 % (actuellement ${totalWeight / 100} %).`,
    });
  }

  // Calculation graph: derived results and the subject result are nodes; an
  // edge exists when a node lists another node as a source. Cycles are
  // rejected (design §11).
  const nodeIds = new Set<string>([...derivedIds]);
  const edges = new Map<string, string[]>();

  for (const derived of config.derivedResults) {
    if (derived.id) {
      edges.set(derived.id, [...derived.sourceDefinitionIds]);
    }
  }

  if (hasCycle(nodeIds, edges)) {
    issues.push({
      code: 'CYCLE_DETECTED',
      message: 'Le calcul contient une dépendance circulaire. Corrigez-la avant de publier.',
    });
  }

  return issues;
}

/** DFS cycle detection over the derived-result graph (nodes only). */
function hasCycle(nodes: Set<string>, edges: Map<string, string[]>): boolean {
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (node: string): boolean => {
    const current = state.get(node);
    if (current === 'done') {
      return false;
    }
    if (current === 'visiting') {
      return true;
    }

    state.set(node, 'visiting');
    for (const target of edges.get(node) ?? []) {
      if (nodes.has(target) && visit(target)) {
        return true;
      }
    }
    state.set(node, 'done');
    return false;
  };

  for (const node of nodes) {
    if (visit(node)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Scope resolution (roadmap §9.9, design §5)
// ---------------------------------------------------------------------------

export interface ScopeResolutionInput {
  /** Policy id + its scope assignments, one entry per policy (published only). */
  policies: {
    policyId: string;
    scopes: PolicyScopeAssignment[];
  }[];
}

export interface ScopeResolutionResult {
  policyId: string;
  /** Which scope level actually matched (the most specific one wins). */
  matchedScope: PolicyScopeType;
}

/**
 * Resolves the effective policy for a (level, subject) scope using
 * `school default -> level -> level + subject` precedence (design §5.1).
 * Returns null when no policy owns a matching scope. Callers must pass only
 * PUBLISHED policies - a draft never resolves.
 */
export function resolvePolicyScope(
  input: ScopeResolutionInput,
  levelId: string,
  subjectId: string | null
): ScopeResolutionResult | null {
  const candidates = input.policies.filter((policy) => policy.scopes.length > 0);

  const levelSubject = candidates.find((policy) =>
    policy.scopes.some(
      (scope) =>
        scope.scopeType === 'LEVEL_SUBJECT' &&
        scope.levelId === levelId &&
        scope.subjectId === subjectId
    )
  );
  if (levelSubject) {
    return { policyId: levelSubject.policyId, matchedScope: 'LEVEL_SUBJECT' };
  }

  const level = candidates.find((policy) =>
    policy.scopes.some((scope) => scope.scopeType === 'LEVEL' && scope.levelId === levelId)
  );
  if (level) {
    return { policyId: level.policyId, matchedScope: 'LEVEL' };
  }

  const schoolDefault = candidates.find((policy) =>
    policy.scopes.some((scope) => scope.scopeType === 'SCHOOL_DEFAULT')
  );
  if (schoolDefault) {
    return { policyId: schoolDefault.policyId, matchedScope: 'SCHOOL_DEFAULT' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Appreciation (roadmap §9.10, design §14)
// ---------------------------------------------------------------------------

/**
 * Validates an appreciation scale: bands must be non-overlapping, contiguous
 * (no gaps between 0 and scaleMax) and inside the scale. Returns issues.
 */
export function validateAppreciationScale(
  input: AppreciationScaleInput
): PolicyValidationIssue[] {
  const issues: PolicyValidationIssue[] = [];
  const bands = [...input.bands].sort((a, b) => b.lowerBound - a.lowerBound);

  if (bands.length === 0) {
    issues.push({
      code: 'EMPTY_ASSESSMENT_TYPES',
      message: 'Ajoutez au moins une tranche d\u2019appréciation.',
    });
    return issues;
  }

  const scaleHundredths = input.scaleMax * 100;

  for (const band of bands) {
    if (band.lowerBound < 0 || band.upperBound > scaleHundredths) {
      issues.push({
        code: 'SCALE_MISMATCH',
        message: 'Les bornes des tranches doivent rester dans le barème.',
      });
    }
    if (band.lowerBound > band.upperBound) {
      issues.push({
        code: 'INVALID_OCCURRENCE_RANGE',
        message: 'La borne inférieure ne peut pas dépasser la borne supérieure.',
      });
    }
  }

  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const next = bands[index + 1];

    if (!band || !next) {
      continue;
    }

    if (next.upperBound + 1 < band.lowerBound) {
      issues.push({
        code: 'WEIGHT_TOTAL',
        message: `Il manque une tranche entre ${formatHundredths(next.upperBound)} et ${formatHundredths(band.lowerBound)}.`,
      });
    }
    if (next.upperBound >= band.lowerBound) {
      issues.push({
        code: 'WEIGHT_TOTAL',
        message: 'Les tranches ne doivent pas se chevaucher.',
      });
    }
  }

  const highest = bands[0];
  const lowest = bands[bands.length - 1];

  if (highest && highest.upperBound < scaleHundredths) {
    issues.push({
      code: 'WEIGHT_TOTAL',
      message: 'La tranche supérieure doit atteindre le barème maximum.',
    });
  }
  if (lowest && lowest.lowerBound > 0) {
    issues.push({
      code: 'WEIGHT_TOTAL',
      message: 'La tranche inférieure doit commencer à zéro.',
    });
  }

  return issues;
}

/**
 * Looks up the appreciation band for an average (integer hundredths) using
 * the descending-lower-bound list. Returns null when no band matches.
 */
export function appreciationForAverage(
  averageHundredths: number,
  bands: readonly AppreciationBandInput[]
): AppreciationBandInput | null {
  const sorted = [...bands].sort((a, b) => b.lowerBound - a.lowerBound);

  return sorted.find(
    (band) => averageHundredths >= band.lowerBound && averageHundredths <= band.upperBound
  ) ?? null;
}

function formatHundredths(value: number): string {
  return (value / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Exported constants (canonical single source)
// ---------------------------------------------------------------------------

export const policyScopeTypes = POLICY_SCOPE_TYPES;
export const assessmentOccurrenceModes = ASSESSMENT_OCCURRENCE_MODES;
export const derivedOperations = DERIVED_OPERATIONS;
export const policyLifecycleStatuses = CONFIG_LIFECYCLE_STATUSES;

export type { PolicyScopeType };
export type { SubjectResultDefinitionInput };
export type { DerivedResultInput };
