import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppreciationScaleInput } from '@edutrack/shared';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { appreciationBand, appreciationScale } from '../schema.sqlite.js';

export interface AppreciationScaleRow {
  id: string;
  logicalScaleId: string;
  version: number;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scaleMax: number;
  publishedAt: string | null;
  createdAt: string;
  bands: {
    id: string;
    lowerBound: number;
    upperBound: number;
    labelFr: string;
    labelAr: string;
    labelEn: string;
    shortLabel: string;
    displayOrder: number;
  }[];
}

/**
 * Tenant-scoped appreciation repository (roadmap §9.10, design §14).
 * Scales are versioned like grading policies: published scales are immutable
 * and a duplicate endpoint creates the next version for future edits, so
 * finalized records never re-read changed labels or thresholds.
 */
export class AppreciationRepository extends TenantScopedRepository {
  createDraft(input: {
    logicalScaleId: string;
    version: number;
    scale: AppreciationScaleInput;
  }): string {
    const scaleId = randomUUID();

    this.db
      .insert(appreciationScale)
      .values({
        id: scaleId,
        schoolId: this.schoolId,
        logicalScaleId: input.logicalScaleId,
        version: input.version,
        name: input.scale.name,
        status: 'DRAFT',
        scaleMax: input.scale.scaleMax,
        publishedAt: null,
      })
      .run();

    this.insertBands(scaleId, input.scale);

    return scaleId;
  }

  find(scaleId: string): AppreciationScaleRow | null {
    const row = this.db
      .select()
      .from(appreciationScale)
      .where(and(eq(appreciationScale.schoolId, this.schoolId), eq(appreciationScale.id, scaleId)))
      .get();

    if (!row) {
      return null;
    }

    return { ...mapScale(row), bands: this.listBands(scaleId) };
  }

  list(): AppreciationScaleRow[] {
    return this.db
      .select()
      .from(appreciationScale)
      .where(
        and(eq(appreciationScale.schoolId, this.schoolId), isNull(appreciationScale.deletedAt))
      )
      .orderBy(asc(appreciationScale.createdAt))
      .all()
      .map((row) => ({ ...mapScale(row), bands: this.listBands(row.id) }));
  }

  /** The school's latest published scale (for readiness/transcript preview). */
  findLatestPublished(): AppreciationScaleRow | null {
    const row = this.db
      .select()
      .from(appreciationScale)
      .where(
        and(
          eq(appreciationScale.schoolId, this.schoolId),
          eq(appreciationScale.status, 'PUBLISHED'),
          isNull(appreciationScale.deletedAt)
        )
      )
      .orderBy(asc(appreciationScale.createdAt))
      .all()
      .at(-1);

    return row ? { ...mapScale(row), bands: this.listBands(row.id) } : null;
  }

  replaceDraft(scaleId: string, scale: AppreciationScaleInput, updatedAt: string): void {
    this.db
      .update(appreciationBand)
      .set({
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${appreciationBand.recordVersion} + 1`,
      })
      .where(
        and(
          eq(appreciationBand.schoolId, this.schoolId),
          eq(appreciationBand.appreciationScaleId, scaleId)
        )
      )
      .run();

    this.insertBands(scaleId, scale);

    this.db
      .update(appreciationScale)
      .set({
        name: scale.name,
        scaleMax: scale.scaleMax,
        updatedAt,
        recordVersion: sql`${appreciationScale.recordVersion} + 1`,
      })
      .where(and(eq(appreciationScale.schoolId, this.schoolId), eq(appreciationScale.id, scaleId)))
      .run();
  }

  publish(scaleId: string, publishedAt: string): void {
    this.db
      .update(appreciationScale)
      .set({
        status: 'PUBLISHED',
        publishedAt,
        updatedAt: publishedAt,
        recordVersion: sql`${appreciationScale.recordVersion} + 1`,
      })
      .where(and(eq(appreciationScale.schoolId, this.schoolId), eq(appreciationScale.id, scaleId)))
      .run();
  }

  supersede(scaleId: string, updatedAt: string): void {
    this.db
      .update(appreciationScale)
      .set({
        status: 'SUPERSEDED',
        updatedAt,
        recordVersion: sql`${appreciationScale.recordVersion} + 1`,
      })
      .where(and(eq(appreciationScale.schoolId, this.schoolId), eq(appreciationScale.id, scaleId)))
      .run();
  }

  maxVersion(logicalScaleId: string): number {
    const row = this.db
      .select({ version: appreciationScale.version })
      .from(appreciationScale)
      .where(
        and(
          eq(appreciationScale.schoolId, this.schoolId),
          eq(appreciationScale.logicalScaleId, logicalScaleId)
        )
      )
      .orderBy(asc(appreciationScale.version))
      .all()
      .at(-1);

    return row?.version ?? 0;
  }

  private insertBands(scaleId: string, scale: AppreciationScaleInput): void {
    for (const band of scale.bands) {
      this.db
        .insert(appreciationBand)
        .values({
          id: randomUUID(),
          schoolId: this.schoolId,
          appreciationScaleId: scaleId,
          lowerBound: band.lowerBound,
          upperBound: band.upperBound,
          labelFr: band.labelFr,
          labelAr: band.labelAr,
          labelEn: band.labelEn,
          shortLabel: band.shortLabel,
          displayOrder: band.displayOrder,
        })
        .run();
    }
  }

  private listBands(scaleId: string) {
    return this.db
      .select()
      .from(appreciationBand)
      .where(
        and(
          eq(appreciationBand.schoolId, this.schoolId),
          eq(appreciationBand.appreciationScaleId, scaleId),
          isNull(appreciationBand.deletedAt)
        )
      )
      .orderBy(asc(appreciationBand.displayOrder))
      .all()
      .map((band) => ({
        id: band.id,
        lowerBound: band.lowerBound,
        upperBound: band.upperBound,
        labelFr: band.labelFr,
        labelAr: band.labelAr,
        labelEn: band.labelEn,
        shortLabel: band.shortLabel,
        displayOrder: band.displayOrder,
      }));
  }
}

function mapScale(row: typeof appreciationScale.$inferSelect) {
  return {
    id: row.id,
    logicalScaleId: row.logicalScaleId,
    version: row.version,
    name: row.name,
    status: row.status,
    scaleMax: row.scaleMax,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

export function createAppreciationRepository(
  db: RepositoryExecutor,
  tenant: TenantContext
): AppreciationRepository {
  return new AppreciationRepository(db, tenant);
}
