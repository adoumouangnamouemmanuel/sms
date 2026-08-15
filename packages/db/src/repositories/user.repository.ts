import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RepositoryExecutor, TenantContext } from './base.js';
import { TenantScopedRepository } from './base.js';
import { user, type UserRole } from '../schema.sqlite.js';

export interface SafeUserRecord {
  id: string;
  schoolId: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  recordVersion: number;
  deletedAt: string | null;
}

export interface CredentialUserRecord extends SafeUserRecord {
  passwordHash: string;
}

export interface CreateUserInput {
  id?: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

/** Owns user credential persistence while public reads stay password-hash safe. */
export class UserRepository extends TenantScopedRepository {
  listActiveUsers() {
    return this.db
      .select(safeUserColumns)
      .from(user)
      .where(and(eq(user.schoolId, this.schoolId), eq(user.isActive, true), isNull(user.deletedAt)))
      .all();
  }

  findActiveByUsername(username: string) {
    return this.db
      .select(safeUserColumns)
      .from(user)
      .where(
        and(
          eq(user.schoolId, this.schoolId),
          eq(user.username, username),
          eq(user.isActive, true),
          isNull(user.deletedAt)
        )
      )
      .get();
  }

  findActiveByUsernameForAuth(username: string) {
    return this.db
      .select(credentialUserColumns)
      .from(user)
      .where(
        and(
          eq(user.schoolId, this.schoolId),
          eq(user.username, username),
          eq(user.isActive, true),
          isNull(user.deletedAt)
        )
      )
      .get();
  }

  findActiveById(userId: string) {
    return this.db
      .select(safeUserColumns)
      .from(user)
      .where(
        and(
          eq(user.schoolId, this.schoolId),
          eq(user.id, userId),
          eq(user.isActive, true),
          isNull(user.deletedAt)
        )
      )
      .get();
  }

  findActiveByIdForAuth(userId: string) {
    return this.db
      .select(credentialUserColumns)
      .from(user)
      .where(
        and(
          eq(user.schoolId, this.schoolId),
          eq(user.id, userId),
          eq(user.isActive, true),
          isNull(user.deletedAt)
        )
      )
      .get();
  }

  createUser(input: CreateUserInput) {
    return this.db
      .insert(user)
      .values({
        id: input.id ?? randomUUID(),
        schoolId: this.schoolId,
        username: input.username,
        passwordHash: input.passwordHash,
        role: input.role,
      })
      .returning(safeUserColumns)
      .get();
  }

  recordSuccessfulLogin(userId: string, loggedInAt: string) {
    return this.db
      .update(user)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: loggedInAt,
        updatedAt: loggedInAt,
        recordVersion: sql`${user.recordVersion} + 1`,
      })
      .where(and(eq(user.schoolId, this.schoolId), eq(user.id, userId)))
      .returning(safeUserColumns)
      .get();
  }

  recordFailedLogin(
    userId: string,
    failedLoginAttempts: number,
    lockedUntil: string | null,
    failedAt: string
  ) {
    return this.db
      .update(user)
      .set({
        failedLoginAttempts,
        lockedUntil,
        updatedAt: failedAt,
        recordVersion: sql`${user.recordVersion} + 1`,
      })
      .where(and(eq(user.schoolId, this.schoolId), eq(user.id, userId)))
      .returning(safeUserColumns)
      .get();
  }

  updatePasswordHash(userId: string, passwordHash: string, changedAt: string) {
    return this.db
      .update(user)
      .set({
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: changedAt,
        recordVersion: sql`${user.recordVersion} + 1`,
      })
      .where(and(eq(user.schoolId, this.schoolId), eq(user.id, userId)))
      .returning(safeUserColumns)
      .get();
  }
}

export function createUserRepository(db: RepositoryExecutor, tenant: TenantContext) {
  return new UserRepository(db, tenant);
}

const safeUserColumns = {
  id: user.id,
  schoolId: user.schoolId,
  username: user.username,
  role: user.role,
  isActive: user.isActive,
  failedLoginAttempts: user.failedLoginAttempts,
  lockedUntil: user.lockedUntil,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  recordVersion: user.recordVersion,
  deletedAt: user.deletedAt,
};

const credentialUserColumns = {
  ...safeUserColumns,
  passwordHash: user.passwordHash,
};
