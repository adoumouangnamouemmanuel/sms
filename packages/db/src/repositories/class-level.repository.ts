import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { SetupClassLevelInput } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base';
import { TenantScopedRepository } from './base';
import { classLevel } from '../schema.sqlite';

export interface ClassLevelRecord {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  displayOrder: number;
  isExamYear: boolean;
  isActive: boolean;
}

/** Persists the tenant-local curriculum levels used by future classroom setup. */
export class ClassLevelRepository extends TenantScopedRepository {
  listActive() {
    return this.db
      .select(classLevelColumns)
      .from(classLevel)
      .where(
        and(
          eq(classLevel.schoolId, this.schoolId),
          eq(classLevel.isActive, true),
          isNull(classLevel.deletedAt)
        )
      )
      .orderBy(asc(classLevel.displayOrder))
      .all();
  }

  replaceActive(inputs: SetupClassLevelInput[], updatedAt: string) {
    const activeCodes = new Set(inputs.map((item) => item.code));
    const existingLevels = this.db
      .select({ id: classLevel.id, code: classLevel.code })
      .from(classLevel)
      .where(eq(classLevel.schoolId, this.schoolId))
      .all();

    // Display order is unique per school, so existing rows move temporarily first.
    this.db
      .update(classLevel)
      .set({
        displayOrder: sql`${classLevel.displayOrder} + 1000`,
        updatedAt,
      })
      .where(eq(classLevel.schoolId, this.schoolId))
      .run();

    for (const existingLevel of existingLevels) {
      if (!activeCodes.has(existingLevel.code)) {
        this.db
          .update(classLevel)
          .set({
            isActive: false,
            deletedAt: updatedAt,
            updatedAt,
            recordVersion: sql`${classLevel.recordVersion} + 1`,
          })
          .where(and(eq(classLevel.schoolId, this.schoolId), eq(classLevel.id, existingLevel.id)))
          .run();
      }
    }

    for (const input of inputs) {
      const existingLevel = existingLevels.find((item) => item.code === input.code);

      if (existingLevel) {
        this.db
          .update(classLevel)
          .set({
            name: input.name,
            displayOrder: input.displayOrder,
            isExamYear: input.isExamYear,
            isActive: true,
            deletedAt: null,
            updatedAt,
            recordVersion: sql`${classLevel.recordVersion} + 1`,
          })
          .where(and(eq(classLevel.schoolId, this.schoolId), eq(classLevel.id, existingLevel.id)))
          .run();
        continue;
      }

      this.db
        .insert(classLevel)
        .values({
          id: randomUUID(),
          schoolId: this.schoolId,
          code: input.code,
          name: input.name,
          displayOrder: input.displayOrder,
          isExamYear: input.isExamYear,
          updatedAt,
        })
        .run();
    }

    return this.listActive();
  }
}

export function createClassLevelRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new ClassLevelRepository(db, tenant);
}

const classLevelColumns = {
  id: classLevel.id,
  schoolId: classLevel.schoolId,
  code: classLevel.code,
  name: classLevel.name,
  displayOrder: classLevel.displayOrder,
  isExamYear: classLevel.isExamYear,
  isActive: classLevel.isActive,
};
