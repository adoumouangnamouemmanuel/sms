import { and, count, eq, isNull } from 'drizzle-orm';
import type { ConfigurationSnapshot } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import {
  academicYear,
  appreciationScale,
  classLevel,
  classSubject,
  gradingPolicy,
  school,
  subject,
} from '../schema.sqlite.js';

/**
 * Reads the live configuration facts the readiness evaluator consumes
 * (roadmap §9.1, design §23). Every query is tenant-scoped by construction;
 * readiness is always computed, never cached, so it cannot go stale.
 *
 * Facts that depend on later phases are reported as unmet so the
 * corresponding capabilities stay blocked until their section lands:
 * - validatedSubmissions -> rebuilt Phase 5 (grade submission)
 * - bulletinConfigured  -> Phase 6 bulletin configuration
 */
export class ConfigurationRepository extends TenantScopedRepository {
  getSnapshot(): ConfigurationSnapshot {
    const schoolRow = this.db
      .select({ setupStatus: school.setupStatus })
      .from(school)
      .where(and(eq(school.id, this.schoolId), isNull(school.deletedAt)))
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
      // No active school row (or an archived one) must never report the
      // profile as complete: undefined !== 'PENDING' would be true.
      schoolProfileComplete: schoolRow !== undefined && schoolRow.setupStatus !== 'PENDING',
      activeAcademicYear: activeYear !== undefined,
      levelCount: levelCountRow?.value ?? 0,
      subjectCount: subjectCountRow?.value ?? 0,
      curriculumClassCount: curriculumCountRow?.value ?? 0,
      publishedGradingPolicies: this.countPublishedPolicies(),
      appreciationConfigured: this.hasPublishedAppreciationScale(),
      validatedSubmissions: 0,
      bulletinConfigured: false,
    };
  }

  private countPublishedPolicies(): number {
    const row = this.db
      .select({ value: count() })
      .from(gradingPolicy)
      .where(
        and(
          eq(gradingPolicy.schoolId, this.schoolId),
          eq(gradingPolicy.status, 'PUBLISHED'),
          isNull(gradingPolicy.deletedAt)
        )
      )
      .get();

    return row?.value ?? 0;
  }

  private hasPublishedAppreciationScale(): boolean {
    const row = this.db
      .select({ id: appreciationScale.id })
      .from(appreciationScale)
      .where(
        and(
          eq(appreciationScale.schoolId, this.schoolId),
          eq(appreciationScale.status, 'PUBLISHED'),
          isNull(appreciationScale.deletedAt)
        )
      )
      .limit(1)
      .get();

    return row !== undefined;
  }
}

export function createConfigurationRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ConfigurationRepository(db, tenant);
}
