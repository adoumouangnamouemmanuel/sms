import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { classLevel, levelSubject, subject } from '../schema.sqlite.js';

export interface LevelSubjectInput {
  subjectId: string;
  coefficient: number;
  isRequired: boolean;
}

export interface LevelSubjectEntry {
  id: string;
  schoolId: string;
  classLevelId: string;
  subjectId: string;
  coefficient: number;
  isRequired: boolean;
  isActive: boolean;
  subjectCode: string;
  subjectName: string;
  subjectCategory: string;
}

/**
 * Level curriculum matrix (roadmap §9.5): coefficient and requirement per
 * subject per level, inherited by every classroom of the level. The matrix is
 * replaced atomically per level (soft-delete removed entries), never patched
 * row by row.
 */
export class LevelSubjectRepository extends TenantScopedRepository {
  listForLevel(classLevelId: string) {
    return this.db
      .select(levelSubjectEntryColumns)
      .from(levelSubject)
      .innerJoin(subject, eq(subject.id, levelSubject.subjectId))
      .where(
        and(
          eq(levelSubject.schoolId, this.schoolId),
          eq(levelSubject.classLevelId, classLevelId),
          eq(levelSubject.isActive, true),
          isNull(levelSubject.deletedAt)
        )
      )
      .orderBy(asc(levelSubject.createdAt))
      .all();
  }

  replaceForLevel(classLevelId: string, entries: LevelSubjectInput[], updatedAt: string) {
    const activeSubjectIds = new Set(entries.map((entry) => entry.subjectId));
    const existingEntries = this.db
      .select({ id: levelSubject.id, subjectId: levelSubject.subjectId })
      .from(levelSubject)
      .where(
        and(eq(levelSubject.schoolId, this.schoolId), eq(levelSubject.classLevelId, classLevelId))
      )
      .all();

    for (const existing of existingEntries) {
      if (!activeSubjectIds.has(existing.subjectId)) {
        this.db
          .update(levelSubject)
          .set({
            isActive: false,
            deletedAt: updatedAt,
            updatedAt,
            recordVersion: sql`${levelSubject.recordVersion} + 1`,
          })
          .where(and(eq(levelSubject.schoolId, this.schoolId), eq(levelSubject.id, existing.id)))
          .run();
      }
    }

    for (const entry of entries) {
      const existing = existingEntries.find((item) => item.subjectId === entry.subjectId);
      const values = {
        coefficient: entry.coefficient,
        isRequired: entry.isRequired,
        isActive: true,
        deletedAt: null,
        updatedAt,
      };

      if (existing) {
        this.db
          .update(levelSubject)
          .set({
            ...values,
            recordVersion: sql`${levelSubject.recordVersion} + 1`,
          })
          .where(and(eq(levelSubject.schoolId, this.schoolId), eq(levelSubject.id, existing.id)))
          .run();
      } else {
        this.db
          .insert(levelSubject)
          .values({
            id: randomUUID(),
            schoolId: this.schoolId,
            classLevelId,
            subjectId: entry.subjectId,
            ...values,
          })
          .run();
      }
    }

    return this.listForLevel(classLevelId);
  }

  /** List levels that already have a matrix, for the configuration UI. */
  listLevelsWithEntries() {
    return this.db
      .selectDistinct({ id: classLevel.id, code: classLevel.code, name: classLevel.name })
      .from(classLevel)
      .innerJoin(levelSubject, eq(levelSubject.classLevelId, classLevel.id))
      .where(
        and(
          eq(classLevel.schoolId, this.schoolId),
          eq(classLevel.isActive, true),
          isNull(classLevel.deletedAt),
          eq(levelSubject.isActive, true),
          isNull(levelSubject.deletedAt)
        )
      )
      .orderBy(asc(classLevel.displayOrder))
      .all();
  }
}

export function createLevelSubjectRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new LevelSubjectRepository(db, tenant);
}

const levelSubjectEntryColumns = {
  id: levelSubject.id,
  schoolId: levelSubject.schoolId,
  classLevelId: levelSubject.classLevelId,
  subjectId: levelSubject.subjectId,
  coefficient: levelSubject.coefficient,
  isRequired: levelSubject.isRequired,
  isActive: levelSubject.isActive,
  subjectCode: subject.code,
  subjectName: subject.name,
  subjectCategory: subject.category,
};
