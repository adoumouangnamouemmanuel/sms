import { and, count, eq, isNull } from 'drizzle-orm';
import type { ConfigurationSnapshot } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { academicYear, classLevel, classSubject, school, subject } from '../schema.sqlite.js';

/**
 * Reads the live configuration facts the readiness evaluator consumes
 * (roadmap §9.1, design §23). Every query is tenant-scoped by construction;
 * readiness is always computed, never cached, so it cannot go stale.
 *
 * Facts whose tables do not exist yet are reported as unmet so the
 * corresponding capabilities stay blocked until their section lands:
 * - publishedGradingPolicies -> roadmap §9.7 (grading_policy)
 * - appreciationConfigured  -> roadmap §9.10 (appreciation_scale)
 * - validatedSubmissions    -> rebuilt Phase 5 (grade submission)
 * - bulletinConfigured      -> Phase 6 bulletin configuration
 */
export class ConfigurationRepository extends TenantScopedRepository {
  getSnapshot(): ConfigurationSnapshot {
    const schoolRow = this.db
      .select({ setupStatus: school.setupStatus })
      .from(school)
      .where(eq(school.id, this.schoolId))
      .get();

    const activeYear = this.db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, this.schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt)
        )
      )
      .get();

    const levelCountRow = this.db
      .select({ value: count() })
      .from(classLevel)
      .where(
        and(
          eq(classLevel.schoolId, this.schoolId),
          eq(classLevel.isActive, true),
          isNull(classLevel.deletedAt)
        )
      )
      .get();

    const subjectCountRow = this.db
      .select({ value: count() })
      .from(subject)
      .where(
        and(
          eq(subject.schoolId, this.schoolId),
          eq(subject.isActive, true),
          isNull(subject.deletedAt)
        )
      )
      .get();

    const curriculumCountRow = this.db
      .select({ value: count() })
      .from(classSubject)
      .where(
        and(
          eq(classSubject.schoolId, this.schoolId),
          eq(classSubject.isActive, true),
          isNull(classSubject.deletedAt)
        )
      )
      .get();

    return {
      schoolProfileComplete: schoolRow?.setupStatus !== 'PENDING',
      activeAcademicYear: activeYear !== undefined,
      levelCount: levelCountRow?.value ?? 0,
      subjectCount: subjectCountRow?.value ?? 0,
      curriculumClassCount: curriculumCountRow?.value ?? 0,
      publishedGradingPolicies: 0,
      appreciationConfigured: false,
      validatedSubmissions: 0,
      bulletinConfigured: false,
    };
  }
}

export function createConfigurationRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ConfigurationRepository(db, tenant);
}
