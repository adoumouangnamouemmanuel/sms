import {
  createAcademicYearRepository,
  createTenantSchoolRepository,
  type RepositoryExecutor,
  type TenantContext,
} from '@edutrack/db';
import { schoolNotFound } from './people.errors.js';

/**
 * Generates the default person code `{school.code}-{academicYearStart}-{NNI}`.
 * Until a real NNI is available, the NNI segment falls back to a zero-padded
 * per-school sequence (001, 002, …) counting archived rows so codes are never
 * reused. Shared by students and teachers so the pending NNI handling (9.4
 * import) changes in exactly one place.
 */
export function generatePeopleCode(
  executor: RepositoryExecutor,
  tenant: TenantContext,
  now: () => Date,
  countAll: () => number
) {
  const school = createTenantSchoolRepository(executor, tenant).findActive();

  if (!school) {
    throw schoolNotFound();
  }

  const academicYear = createAcademicYearRepository(executor, tenant).findCurrent();
  const year = extractAcademicYearStart(academicYear?.label) ?? String(now().getFullYear());
  // countAll includes archived records: their codes are never reused, so the
  // full count keeps the generated sequence free of collisions.
  const sequence = countAll() + 1;

  return `${school.code}-${year}-${String(sequence).padStart(3, '0')}`.toUpperCase();
}

export function extractAcademicYearStart(label: string | null | undefined) {
  return label?.match(/^(\d{4})/)?.[1];
}

export function normalizePeopleCode(code: string) {
  return code.trim().toUpperCase();
}
