import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { subject, subjectGroup, subjectGroupMember } from '../schema.sqlite.js';

export interface SubjectGroupRecord {
  id: string;
  schoolId: string;
  name: string;
  nameEn: string | null;
  nameAr: string | null;
  displayOrder: number;
  isActive: boolean;
  recordVersion: number;
}

export interface SubjectGroupWithCount extends SubjectGroupRecord {
  subjectCount: number;
}

export interface SubjectGroupMemberInput {
  subjectId: string;
  displayOrder: number;
}

export interface SubjectGroupMemberEntry {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  displayOrder: number;
}

/**
 * Temporary display order used while reordering retained members. Must stay
 * above any real order so the (school_id, subject_group_id, display_order)
 * unique index is never violated mid-write (see replaceMembers).
 */
const TEMP_DISPLAY_ORDER_PARK = 1_000_000;

/**
 * School-defined subject groups / sections (roadmap §9.6). Groups carry a
 * stable display order and an editable membership; membership is replaced
 * atomically (array order becomes display order).
 */
export class SubjectGroupRepository extends TenantScopedRepository {
  listWithCounts() {
    return this.db
      .select({
        id: subjectGroup.id,
        schoolId: subjectGroup.schoolId,
        name: subjectGroup.name,
        nameEn: subjectGroup.nameEn,
        nameAr: subjectGroup.nameAr,
        displayOrder: subjectGroup.displayOrder,
        isActive: subjectGroup.isActive,
        recordVersion: subjectGroup.recordVersion,
        subjectCount: count(subjectGroupMember.id),
      })
      .from(subjectGroup)
      .leftJoin(subjectGroupMember, eq(subjectGroupMember.subjectGroupId, subjectGroup.id))
      .where(
        and(
          eq(subjectGroup.schoolId, this.schoolId),
          eq(subjectGroup.isActive, true),
          isNull(subjectGroup.deletedAt),
          isNull(subjectGroupMember.deletedAt)
        )
      )
      .groupBy(subjectGroup.id)
      .orderBy(asc(subjectGroup.displayOrder))
      .all();
  }

  findById(id: string) {
    return this.db
      .select(subjectGroupColumns)
      .from(subjectGroup)
      .where(and(eq(subjectGroup.id, id), eq(subjectGroup.schoolId, this.schoolId)))
      .get();
  }

  create(
    input: Omit<SubjectGroupRecord, 'id' | 'schoolId' | 'isActive' | 'recordVersion'>,
    updatedAt: string
  ) {
    return this.db
      .insert(subjectGroup)
      .values({
        id: randomUUID(),
        schoolId: this.schoolId,
        ...input,
        updatedAt,
      })
      .returning(subjectGroupColumns)
      .get();
  }

  update(
    id: string,
    input: Partial<Omit<SubjectGroupRecord, 'id' | 'schoolId'>>,
    updatedAt: string
  ) {
    return this.db
      .update(subjectGroup)
      .set({
        ...input,
        updatedAt,
        recordVersion: sql`${subjectGroup.recordVersion} + 1`,
      })
      .where(and(eq(subjectGroup.schoolId, this.schoolId), eq(subjectGroup.id, id)))
      .returning(subjectGroupColumns)
      .get();
  }

  archive(id: string, updatedAt: string) {
    return this.db
      .update(subjectGroup)
      .set({
        isActive: false,
        deletedAt: updatedAt,
        updatedAt,
        recordVersion: sql`${subjectGroup.recordVersion} + 1`,
      })
      .where(and(eq(subjectGroup.schoolId, this.schoolId), eq(subjectGroup.id, id)))
      .returning(subjectGroupColumns)
      .get();
  }

  reactivate(id: string, updatedAt: string) {
    return this.db
      .update(subjectGroup)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt,
        recordVersion: sql`${subjectGroup.recordVersion} + 1`,
      })
      .where(and(eq(subjectGroup.schoolId, this.schoolId), eq(subjectGroup.id, id)))
      .returning(subjectGroupColumns)
      .get();
  }

  listMembers(subjectGroupId: string) {
    return this.db
      .select({
        subjectId: subjectGroupMember.subjectId,
        subjectCode: subject.code,
        subjectName: subject.name,
        displayOrder: subjectGroupMember.displayOrder,
      })
      .from(subjectGroupMember)
      .innerJoin(subject, eq(subject.id, subjectGroupMember.subjectId))
      .where(
        and(
          eq(subjectGroupMember.schoolId, this.schoolId),
          eq(subjectGroupMember.subjectGroupId, subjectGroupId),
          eq(subjectGroupMember.isActive, true),
          isNull(subjectGroupMember.deletedAt)
        )
      )
      .orderBy(asc(subjectGroupMember.displayOrder))
      .all();
  }

  /** Replaces membership atomically: array order becomes the display order. */
  replaceMembers(subjectGroupId: string, subjectIds: string[], updatedAt: string) {
    const activeSubjectIds = new Set(subjectIds);
    const existingMembers = this.db
      .select({ id: subjectGroupMember.id, subjectId: subjectGroupMember.subjectId })
      .from(subjectGroupMember)
      .where(
        and(
          eq(subjectGroupMember.schoolId, this.schoolId),
          eq(subjectGroupMember.subjectGroupId, subjectGroupId)
        )
      )
      .all();

    for (const existing of existingMembers) {
      if (!activeSubjectIds.has(existing.subjectId)) {
        this.db
          .update(subjectGroupMember)
          .set({
            isActive: false,
            deletedAt: updatedAt,
            updatedAt,
            recordVersion: sql`${subjectGroupMember.recordVersion} + 1`,
          })
          .where(
            and(
              eq(subjectGroupMember.schoolId, this.schoolId),
              eq(subjectGroupMember.id, existing.id)
            )
          )
          .run();
      }
    }

    // Retained members keep their rows; the desired order is the array order.
    // Writing the final display orders one by one would collide with the
    // (school_id, subject_group_id, display_order) unique index whenever two
    // retained members swap positions, so first park every retained row on a
    // temporary out-of-range display order, then write the final orders.
    const retained = existingMembers.filter((item) => activeSubjectIds.has(item.subjectId));
    retained.forEach((existing, index) => {
      this.db
        .update(subjectGroupMember)
        .set({
          displayOrder: TEMP_DISPLAY_ORDER_PARK + index,
          updatedAt,
          recordVersion: sql`${subjectGroupMember.recordVersion} + 1`,
        })
        .where(
          and(
            eq(subjectGroupMember.schoolId, this.schoolId),
            eq(subjectGroupMember.id, existing.id)
          )
        )
        .run();
    });

    subjectIds.forEach((subjectId, index) => {
      const existing = existingMembers.find((item) => item.subjectId === subjectId);
      const values = {
        displayOrder: index + 1,
        isActive: true,
        deletedAt: null,
        updatedAt,
      };

      if (existing) {
        this.db
          .update(subjectGroupMember)
          .set({
            ...values,
            recordVersion: sql`${subjectGroupMember.recordVersion} + 1`,
          })
          .where(
            and(
              eq(subjectGroupMember.schoolId, this.schoolId),
              eq(subjectGroupMember.id, existing.id)
            )
          )
          .run();
      } else {
        this.db
          .insert(subjectGroupMember)
          .values({
            id: randomUUID(),
            schoolId: this.schoolId,
            subjectGroupId,
            subjectId,
            ...values,
          })
          .run();
      }
    });

    return this.listMembers(subjectGroupId);
  }
}

export function createSubjectGroupRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new SubjectGroupRepository(db, tenant);
}

const subjectGroupColumns = {
  id: subjectGroup.id,
  schoolId: subjectGroup.schoolId,
  name: subjectGroup.name,
  nameEn: subjectGroup.nameEn,
  nameAr: subjectGroup.nameAr,
  displayOrder: subjectGroup.displayOrder,
  isActive: subjectGroup.isActive,
  recordVersion: subjectGroup.recordVersion,
};
