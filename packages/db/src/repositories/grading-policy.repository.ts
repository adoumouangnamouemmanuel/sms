import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DerivedResultInput, GradingPolicyConfig } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import {
  assessmentTypeDefinition,
  derivedResultDefinition,
  gradingPolicy,
  policyScope,
  subjectResultDefinition,
  subjectResultInput,
} from '../schema.sqlite.js';

export interface PolicyScopeRow {
  id: string;
  policyId: string;
  scopeType: 'SCHOOL_DEFAULT' | 'LEVEL' | 'LEVEL_SUBJECT';
  levelId: string | null;
  subjectId: string | null;
}

export interface PolicyScopeInput {
  scopeType: 'SCHOOL_DEFAULT' | 'LEVEL' | 'LEVEL_SUBJECT';
  levelId: string | null;
  subjectId: string | null;
}

export interface PolicySummaryRow {
  id: string;
  logicalPolicyId: string;
  version: number;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scaleMax: number;
  passThreshold: number;
  decimalPrecision: number;
  roundingMode: 'HALF_UP' | 'TRUNCATE';
  effectiveAcademicYearId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

/**
 * Tenant-scoped grading-policy repository (roadmap §9.7). A policy is a
 * versioned document: the header row plus its assessment types, derived
 * results and the one subject result with weighted inputs. Published
 * versions are immutable - editing always creates a new version row
 * (duplicate endpoint); the schema's partial scope indexes keep one
 * published policy per scope slot.
 */
export class GradingPolicyRepository extends TenantScopedRepository {
  createDraft(
    input: {
      logicalPolicyId: string;
      version: number;
      createdBy: string | null;
      config: GradingPolicyConfig;
    },
    updatedAt: string
  ): string {
    const policyId = randomUUID();

    this.insertPolicyHeader({
      id: policyId,
      logicalPolicyId: input.logicalPolicyId,
      version: input.version,
      status: 'DRAFT',
      createdBy: input.createdBy,
      publishedBy: null,
      publishedAt: null,
      supersedesPolicyId: null,
      config: input.config,
      updatedAt,
    });

    return policyId;
  }

  /** Full detail of one policy (header + children) or null when missing. */
  findDetail(policyId: string): {
    header: PolicySummaryRow;
    config: GradingPolicyConfig;
  } | null {
    const header = this.db
      .select()
      .from(gradingPolicy)
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), eq(gradingPolicy.id, policyId)))
      .get();

    if (!header) {
      return null;
    }

    return {
      header: mapSummary(header),
      config: this.loadConfig(policyId),
    };
  }

  findSummary(policyId: string): PolicySummaryRow | null {
    const header = this.db
      .select()
      .from(gradingPolicy)
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), eq(gradingPolicy.id, policyId)))
      .get();

    return header ? mapSummary(header) : null;
  }

  listSummaries(): PolicySummaryRow[] {
    return this.db
      .select()
      .from(gradingPolicy)
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), isNull(gradingPolicy.deletedAt)))
      .orderBy(asc(gradingPolicy.createdAt), asc(gradingPolicy.version))
      .all()
      .map(mapSummary);
  }

  listDetails(): { header: PolicySummaryRow; config: GradingPolicyConfig }[] {
    return this.listSummaries().map((header) => ({
      header,
      config: this.loadConfig(header.id),
    }));
  }

  /**
   * Replaces a DRAFT's whole document (header + children) atomically.
   * Called inside the service transaction - published documents are
   * immutable and must never reach this method.
   */
  replaceDraftConfig(policyId: string, config: GradingPolicyConfig, updatedAt: string): void {
    this.deleteChildren(policyId, updatedAt);
    this.insertPolicyChildren(policyId, config);
    this.db
      .update(gradingPolicy)
      .set({
        name: config.name,
        scaleMax: config.scaleMax,
        passThreshold: config.passThreshold,
        decimalPrecision: config.decimalPrecision,
        roundingMode: config.roundingMode,
        effectiveAcademicYearId: config.effectiveAcademicYearId,
        updatedAt,
        recordVersion: sql`${gradingPolicy.recordVersion} + 1`,
      })
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), eq(gradingPolicy.id, policyId)))
      .run();
  }

  publish(
    policyId: string,
    publishedBy: string,
    publishedAt: string,
    supersedesPolicyId: string | null
  ): void {
    this.db
      .update(gradingPolicy)
      .set({
        status: 'PUBLISHED',
        publishedBy,
        publishedAt,
        supersedesPolicyId,
        updatedAt: publishedAt,
        recordVersion: sql`${gradingPolicy.recordVersion} + 1`,
      })
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), eq(gradingPolicy.id, policyId)))
      .run();
  }

  supersede(policyId: string, updatedAt: string): void {
    this.db
      .update(gradingPolicy)
      .set({
        status: 'SUPERSEDED',
        updatedAt,
        recordVersion: sql`${gradingPolicy.recordVersion} + 1`,
      })
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), eq(gradingPolicy.id, policyId)))
      .run();
  }

  /** Highest version number used by a logical policy (0 when none). */
  maxVersion(logicalPolicyId: string): number {
    const row = this.db
      .select({ version: gradingPolicy.version })
      .from(gradingPolicy)
      .where(
        and(
          eq(gradingPolicy.schoolId, this.schoolId),
          eq(gradingPolicy.logicalPolicyId, logicalPolicyId)
        )
      )
      .orderBy(descVersion)
      .limit(1)
      .get();

    return row?.version ?? 0;
  }

  // -------------------------------------------------------------------------
  // Scopes (roadmap §9.9)
  // -------------------------------------------------------------------------

  replaceScopes(policyId: string, scopes: PolicyScopeInput[], updatedAt: string): void {
    this.db
      .update(policyScope)
      .set({
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${policyScope.recordVersion} + 1`,
      })
      .where(
        and(eq(policyScope.schoolId, this.schoolId), eq(policyScope.gradingPolicyId, policyId))
      )
      .run();

    for (const scope of scopes) {
      this.db
        .insert(policyScope)
        .values({
          id: randomUUID(),
          schoolId: this.schoolId,
          gradingPolicyId: policyId,
          scopeType: scope.scopeType,
          classLevelId: scope.levelId,
          subjectId: scope.subjectId,
        })
        .run();
    }
  }

  listScopes(policyId: string): PolicyScopeRow[] {
    return this.db
      .select({
        id: policyScope.id,
        policyId: policyScope.gradingPolicyId,
        scopeType: policyScope.scopeType,
        levelId: policyScope.classLevelId,
        subjectId: policyScope.subjectId,
      })
      .from(policyScope)
      .where(
        and(
          eq(policyScope.schoolId, this.schoolId),
          eq(policyScope.gradingPolicyId, policyId),
          isNull(policyScope.deletedAt)
        )
      )
      .orderBy(asc(policyScope.createdAt))
      .all();
  }

  listAllScopes(): PolicyScopeRow[] {
    return this.db
      .select({
        id: policyScope.id,
        policyId: policyScope.gradingPolicyId,
        scopeType: policyScope.scopeType,
        levelId: policyScope.classLevelId,
        subjectId: policyScope.subjectId,
      })
      .from(policyScope)
      .where(and(eq(policyScope.schoolId, this.schoolId), isNull(policyScope.deletedAt)))
      .all();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private insertPolicyHeader(input: {
    id: string;
    logicalPolicyId: string;
    version: number;
    status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
    createdBy: string | null;
    publishedBy: string | null;
    publishedAt: string | null;
    supersedesPolicyId: string | null;
    config: GradingPolicyConfig;
    updatedAt: string;
  }): void {
    this.db
      .insert(gradingPolicy)
      .values({
        id: input.id,
        schoolId: this.schoolId,
        logicalPolicyId: input.logicalPolicyId,
        version: input.version,
        name: input.config.name,
        status: input.status,
        scaleMax: input.config.scaleMax,
        passThreshold: input.config.passThreshold,
        decimalPrecision: input.config.decimalPrecision,
        roundingMode: input.config.roundingMode,
        effectiveAcademicYearId: input.config.effectiveAcademicYearId,
        createdBy: input.createdBy,
        publishedBy: input.publishedBy,
        publishedAt: input.publishedAt,
        supersedesPolicyId: input.supersedesPolicyId,
      })
      .run();

    this.insertPolicyChildren(input.id, input.config);
  }

  private insertPolicyChildren(policyId: string, config: GradingPolicyConfig): void {
    // Every child row gets a fresh persisted id. The client's ids (sent in
    // the config) are only used to resolve graph references between children
    // (assessment types -> derived sources -> subject inputs); they are never
    // persisted, so different policy versions never collide on ids.
    const clientIdToPersistedId = new Map<string, string>();

    for (const definition of config.assessmentTypes) {
      const id = randomUUID();
      if (definition.id) {
        clientIdToPersistedId.set(definition.id, id);
      }

      this.db
        .insert(assessmentTypeDefinition)
        .values({
          id,
          schoolId: this.schoolId,
          gradingPolicyId: policyId,
          name: definition.name,
          shortName: definition.shortName,
          scaleMax: definition.scaleMax,
          occurrenceMode: definition.occurrenceMode,
          minOccurrences: definition.minOccurrences,
          maxOccurrences: definition.maxOccurrences,
          required: definition.required,
          teacherCanCreateInstances: definition.teacherCanCreateInstances,
          displayOrder: definition.displayOrder,
        })
        .run();
    }

    // Register every derived id first, then insert - a derived result may
    // reference another derived result, so source resolution must see the
    // whole id mapping (two-pass, design §11 DAG).
    const derivedRows: { id: string; derived: DerivedResultInput }[] = [];
    for (const derived of config.derivedResults) {
      const id = randomUUID();
      if (derived.id) {
        clientIdToPersistedId.set(derived.id, id);
      }
      derivedRows.push({ id, derived });
    }

    for (const { id, derived } of derivedRows) {
      this.db
        .insert(derivedResultDefinition)
        .values({
          id,
          schoolId: this.schoolId,
          gradingPolicyId: policyId,
          name: derived.name,
          shortName: derived.shortName,
          operation: derived.operation,
          sourceDefinitionIds: JSON.stringify(
            derived.sourceDefinitionIds.map(
              (sourceId) => clientIdToPersistedId.get(sourceId) ?? sourceId
            )
          ),
          precision: derived.precision,
          roundingMode: derived.roundingMode,
          displayOrder: derived.displayOrder,
        })
        .run();
    }

    const subjectResultId = randomUUID();
    this.db
      .insert(subjectResultDefinition)
      .values({
        id: subjectResultId,
        schoolId: this.schoolId,
        gradingPolicyId: policyId,
        name: config.subjectResult.name,
        shortName: config.subjectResult.shortName,
        precision: config.subjectResult.precision,
        roundingMode: config.subjectResult.roundingMode,
      })
      .run();

    for (const input of config.subjectResult.inputs) {
      this.db
        .insert(subjectResultInput)
        .values({
          id: randomUUID(),
          schoolId: this.schoolId,
          subjectResultDefinitionId: subjectResultId,
          sourceDefinitionId:
            clientIdToPersistedId.get(input.sourceDefinitionId) ?? input.sourceDefinitionId,
          weight: input.weight,
          displayOrder: input.displayOrder,
        })
        .run();
    }
  }

  private loadConfig(policyId: string): GradingPolicyConfig {
    const header = this.db
      .select()
      .from(gradingPolicy)
      .where(and(eq(gradingPolicy.schoolId, this.schoolId), eq(gradingPolicy.id, policyId)))
      .get();

    if (!header) {
      throw new Error(`Grading policy ${policyId} disappeared mid-read.`);
    }

    const assessmentTypes = this.db
      .select()
      .from(assessmentTypeDefinition)
      .where(
        and(
          eq(assessmentTypeDefinition.schoolId, this.schoolId),
          eq(assessmentTypeDefinition.gradingPolicyId, policyId),
          isNull(assessmentTypeDefinition.deletedAt)
        )
      )
      .orderBy(asc(assessmentTypeDefinition.displayOrder))
      .all();

    const derivedResults = this.db
      .select()
      .from(derivedResultDefinition)
      .where(
        and(
          eq(derivedResultDefinition.schoolId, this.schoolId),
          eq(derivedResultDefinition.gradingPolicyId, policyId),
          isNull(derivedResultDefinition.deletedAt)
        )
      )
      .orderBy(asc(derivedResultDefinition.displayOrder))
      .all();

    const subjectResult = this.db
      .select()
      .from(subjectResultDefinition)
      .where(
        and(
          eq(subjectResultDefinition.schoolId, this.schoolId),
          eq(subjectResultDefinition.gradingPolicyId, policyId),
          isNull(subjectResultDefinition.deletedAt)
        )
      )
      .get();

    const inputs = subjectResult
      ? this.db
          .select()
          .from(subjectResultInput)
          .where(
            and(
              eq(subjectResultInput.schoolId, this.schoolId),
              eq(subjectResultInput.subjectResultDefinitionId, subjectResult.id),
              isNull(subjectResultInput.deletedAt)
            )
          )
          .orderBy(asc(subjectResultInput.displayOrder))
          .all()
      : [];

    // Keep the ids the client sent stable across save cycles: assessment-type
    // and derived ids persist verbatim (derived ids double as graph nodes).
    return {
      name: header.name,
      scaleMax: header.scaleMax,
      passThreshold: header.passThreshold,
      decimalPrecision: header.decimalPrecision,
      roundingMode: header.roundingMode,
      effectiveAcademicYearId: header.effectiveAcademicYearId,
      assessmentTypes: assessmentTypes.map((definition) => ({
        id: definition.id,
        name: definition.name,
        shortName: definition.shortName,
        scaleMax: definition.scaleMax,
        occurrenceMode: definition.occurrenceMode,
        minOccurrences: definition.minOccurrences,
        maxOccurrences: definition.maxOccurrences,
        required: definition.required,
        teacherCanCreateInstances: definition.teacherCanCreateInstances,
        displayOrder: definition.displayOrder,
      })),
      derivedResults: derivedResults.map((derived) => ({
        id: derived.id,
        name: derived.name,
        shortName: derived.shortName,
        operation: derived.operation,
        sourceDefinitionIds: JSON.parse(derived.sourceDefinitionIds) as string[],
        precision: derived.precision,
        roundingMode: derived.roundingMode,
        displayOrder: derived.displayOrder,
      })),
      subjectResult: {
        name: subjectResult?.name ?? header.name,
        shortName: subjectResult?.shortName ?? 'Moy.',
        precision: subjectResult?.precision ?? header.decimalPrecision,
        roundingMode: subjectResult?.roundingMode ?? header.roundingMode,
        inputs: inputs.map((input) => ({
          sourceDefinitionId: input.sourceDefinitionId,
          weight: input.weight,
          displayOrder: input.displayOrder,
        })),
      },
    };
  }

  private deleteChildren(policyId: string, updatedAt: string): void {
    for (const table of [
      assessmentTypeDefinition,
      derivedResultDefinition,
      subjectResultDefinition,
    ]) {
      this.db
        .update(table)
        .set({
          deletedAt: updatedAt,
          updatedAt,
          recordVersion: sql`${table.recordVersion} + 1`,
        })
        .where(and(eq(table.schoolId, this.schoolId), eq(table.gradingPolicyId, policyId)))
        .run();
    }

    // subject_result_input links through its definition, not the policy.
    this.db
      .update(subjectResultInput)
      .set({
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${subjectResultInput.recordVersion} + 1`,
      })
      .where(
        and(
          eq(subjectResultInput.schoolId, this.schoolId),
          sql`${subjectResultInput.subjectResultDefinitionId} IN (SELECT id FROM ${subjectResultDefinition} WHERE ${subjectResultDefinition.gradingPolicyId} = ${policyId})`
        )
      )
      .run();
  }
}

const descVersion = sql`${gradingPolicy.version} DESC`;

function mapSummary(row: typeof gradingPolicy.$inferSelect): PolicySummaryRow {
  return {
    id: row.id,
    logicalPolicyId: row.logicalPolicyId,
    version: row.version,
    name: row.name,
    status: row.status,
    scaleMax: row.scaleMax,
    passThreshold: row.passThreshold,
    decimalPrecision: row.decimalPrecision,
    roundingMode: row.roundingMode,
    effectiveAcademicYearId: row.effectiveAcademicYearId,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

export function createGradingPolicyRepository(
  db: RepositoryExecutor,
  tenant: TenantContext
): GradingPolicyRepository {
  return new GradingPolicyRepository(db, tenant);
}
