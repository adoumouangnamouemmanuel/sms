import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base';
import { TenantScopedRepository } from './base';
import { refreshSession } from '../schema.sqlite';

export interface RefreshSessionRecord {
  id: string;
  schoolId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  replacedBySessionId: string | null;
  deviceName: string | null;
  userAgentHash: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recordVersion: number;
  deletedAt: string | null;
}

export interface CreateRefreshSessionInput {
  id?: string;
  userId: string;
  tokenHash: string;
  familyId?: string;
  deviceName?: string | null | undefined;
  userAgentHash?: string | null | undefined;
  expiresAt: string;
}

/** Persists one-time refresh tokens and revokes whole token families on reuse. */
export class RefreshSessionRepository extends TenantScopedRepository {
  createSession(input: CreateRefreshSessionInput) {
    return this.db
      .insert(refreshSession)
      .values({
        id: input.id ?? randomUUID(),
        schoolId: this.schoolId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId ?? randomUUID(),
        deviceName: input.deviceName ?? null,
        userAgentHash: input.userAgentHash ?? null,
        expiresAt: input.expiresAt,
      })
      .returning(refreshSessionColumns)
      .get();
  }

  findByIdAndTokenHash(sessionId: string, tokenHash: string) {
    return this.db
      .select(refreshSessionColumns)
      .from(refreshSession)
      .where(
        and(
          eq(refreshSession.schoolId, this.schoolId),
          eq(refreshSession.id, sessionId),
          eq(refreshSession.tokenHash, tokenHash)
        )
      )
      .get();
  }

  replaceSession(sessionId: string, replacementSessionId: string, replacedAt: string) {
    return this.db
      .update(refreshSession)
      .set({
        replacedBySessionId: replacementSessionId,
        revokedAt: replacedAt,
        updatedAt: replacedAt,
        recordVersion: sql`${refreshSession.recordVersion} + 1`,
      })
      .where(
        and(
          eq(refreshSession.schoolId, this.schoolId),
          eq(refreshSession.id, sessionId),
          isNull(refreshSession.replacedBySessionId),
          isNull(refreshSession.revokedAt)
        )
      )
      .returning(refreshSessionColumns)
      .get();
  }

  revokeSession(sessionId: string, revokedAt: string) {
    return this.db
      .update(refreshSession)
      .set({
        revokedAt,
        updatedAt: revokedAt,
        recordVersion: sql`${refreshSession.recordVersion} + 1`,
      })
      .where(and(eq(refreshSession.schoolId, this.schoolId), eq(refreshSession.id, sessionId)))
      .returning(refreshSessionColumns)
      .get();
  }

  revokeFamily(familyId: string, revokedAt: string) {
    return this.db
      .update(refreshSession)
      .set({
        revokedAt,
        updatedAt: revokedAt,
        recordVersion: sql`${refreshSession.recordVersion} + 1`,
      })
      .where(and(eq(refreshSession.schoolId, this.schoolId), eq(refreshSession.familyId, familyId)))
      .run();
  }

  revokeUserSessions(userId: string, revokedAt: string) {
    return this.db
      .update(refreshSession)
      .set({
        revokedAt,
        updatedAt: revokedAt,
        recordVersion: sql`${refreshSession.recordVersion} + 1`,
      })
      .where(and(eq(refreshSession.schoolId, this.schoolId), eq(refreshSession.userId, userId)))
      .run();
  }
}

export function createRefreshSessionRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new RefreshSessionRepository(db, tenant);
}

const refreshSessionColumns = {
  id: refreshSession.id,
  schoolId: refreshSession.schoolId,
  userId: refreshSession.userId,
  tokenHash: refreshSession.tokenHash,
  familyId: refreshSession.familyId,
  replacedBySessionId: refreshSession.replacedBySessionId,
  deviceName: refreshSession.deviceName,
  userAgentHash: refreshSession.userAgentHash,
  expiresAt: refreshSession.expiresAt,
  revokedAt: refreshSession.revokedAt,
  createdAt: refreshSession.createdAt,
  updatedAt: refreshSession.updatedAt,
  recordVersion: refreshSession.recordVersion,
  deletedAt: refreshSession.deletedAt,
};
