/**
 * Phase 4 — classes and curriculum domain constants (roadmap §10).
 */

/** Subject catalogue categories; French display labels live in the UI i18n. */
export const SUBJECT_CATEGORIES = [
  'LANGUES',
  'SCIENCES',
  'MATHEMATIQUES',
  'SCIENCES_SOCIALES',
  'ARTS',
  'SPORTS',
  'AUTRE',
] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

/**
 * Controlled class-enrollment statuses (AGENTS.md §9.3): state transitions are
 * validated at the service layer — never free-form string updates.
 */
export const ENROLLMENT_STATUSES = [
  'ACTIVE',
  'TRANSFERRED',
  'WITHDRAWN',
  'GRADUATED',
  'PROMOTED',
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/**
 * Official maximum grade policy (AGENTS.md §9.1 and roadmap §10.1): 20.00,
 * stored as integer hundredths and enforced at validation boundaries.
 */
export const MAX_GRADE_HUNDREDTHS = 2000;
