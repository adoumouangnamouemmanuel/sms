import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { IMPLEMENTED_SCHOOL_MODULES, type SchoolModuleName } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base';
import { TenantScopedRepository } from './base';
import { schoolModuleConfig } from '../schema.sqlite';

export interface SchoolModuleConfigRecord {
  id: string;
  schoolId: string;
  moduleName: SchoolModuleName;
  isEnabled: boolean;
  configJson: string;
}

/** Keeps per-school module visibility limited to modules actually implemented. */
export class SchoolModuleConfigRepository extends TenantScopedRepository {
  listEnabled() {
    return this.db
      .select(schoolModuleConfigColumns)
      .from(schoolModuleConfig)
      .where(
        and(
          eq(schoolModuleConfig.schoolId, this.schoolId),
          eq(schoolModuleConfig.isEnabled, true),
          isNull(schoolModuleConfig.deletedAt)
        )
      )
      .orderBy(asc(schoolModuleConfig.moduleName))
      .all();
  }

  ensureImplementedModulesEnabled(updatedAt: string) {
    for (const moduleName of IMPLEMENTED_SCHOOL_MODULES) {
      const existingModule = this.db
        .select({ id: schoolModuleConfig.id })
        .from(schoolModuleConfig)
        .where(
          and(
            eq(schoolModuleConfig.schoolId, this.schoolId),
            eq(schoolModuleConfig.moduleName, moduleName)
          )
        )
        .get();

      if (existingModule) {
        this.db
          .update(schoolModuleConfig)
          .set({
            isEnabled: true,
            deletedAt: null,
            updatedAt,
            recordVersion: sql`${schoolModuleConfig.recordVersion} + 1`,
          })
          .where(
            and(
              eq(schoolModuleConfig.schoolId, this.schoolId),
              eq(schoolModuleConfig.id, existingModule.id)
            )
          )
          .run();
        continue;
      }

      this.db
        .insert(schoolModuleConfig)
        .values({
          id: randomUUID(),
          schoolId: this.schoolId,
          moduleName,
          isEnabled: true,
          updatedAt,
        })
        .run();
    }

    return this.listEnabled();
  }
}

export function createSchoolModuleConfigRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new SchoolModuleConfigRepository(db, tenant);
}

const schoolModuleConfigColumns = {
  id: schoolModuleConfig.id,
  schoolId: schoolModuleConfig.schoolId,
  moduleName: schoolModuleConfig.moduleName,
  isEnabled: schoolModuleConfig.isEnabled,
  configJson: schoolModuleConfig.configJson,
};
