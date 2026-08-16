import type { AcademicYearStatus } from '@edutrack/shared';

/**
 * Phase 3.3 - pure academic-year lifecycle rules (roadmap §9.3, design §4.1).
 *
 * Deterministic transition validation only: DRAFT -> ACTIVE -> CLOSED.
 * Exactly one ACTIVE year per school is enforced by the service (rollover
 * closes the previous year) and backed by the partial unique index in
 * migration 0018. No database, no HTTP, no French.
 */

const ACADEMIC_YEAR_TRANSITIONS: Record<AcademicYearStatus, readonly AcademicYearStatus[]> = {
  DRAFT: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionAcademicYearStatus(
  from: AcademicYearStatus,
  to: AcademicYearStatus
): boolean {
  return ACADEMIC_YEAR_TRANSITIONS[from].includes(to);
}

/** Thrown when a caller attempts a year-status transition the model forbids. */
export class AcademicYearTransitionError extends Error {
  constructor(
    readonly from: AcademicYearStatus,
    readonly to: AcademicYearStatus
  ) {
    super(`Transition invalide de l'année académique ${from} vers ${to}.`);
    this.name = 'AcademicYearTransitionError';
  }
}

/** Enforces the lifecycle; throws AcademicYearTransitionError when invalid. */
export function assertAcademicYearStatusTransition(
  from: AcademicYearStatus,
  to: AcademicYearStatus
): void {
  if (!canTransitionAcademicYearStatus(from, to)) {
    throw new AcademicYearTransitionError(from, to);
  }
}
