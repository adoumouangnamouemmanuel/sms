import {
  createAuditLogRepository,
  createTeacherRepository,
  createTenantContext,
  createUserRepository,
  withTransaction,
  type EduTrackDatabase,
  type UpdateTeacherInput,
} from '@edutrack/db';
import type {
  ArchiveTeacherRequest,
  CreateTeacherRequest,
  DeactivateTeacherLoginRequest,
  PaginatedTeachersResponse,
  TeacherListQuery,
  TeacherLoginCreatedResponse,
  TeacherProfileResponse,
  TeacherResponse,
  UpdateTeacherRequest,
} from '@edutrack/shared';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/auth.crypto.js';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { generatePeopleCode, normalizePeopleCode } from './people.codes.js';
import { toLoginView, toTeacherResponse } from './people.mappers.js';
import {
  peopleForbidden,
  teacherCodeAlreadyExists,
  teacherLoginAlreadyExists,
  teacherLoginNotFound,
  teacherLoginRequiresActiveRecord,
  teacherNotFound,
  teacherVersionConflict,
} from './people.errors.js';

export interface TeachersServiceOptions {
  now?: () => Date;
}

const MAX_GENERATED_CODE_ATTEMPTS = 5;
// Unambiguous characters only (no 0/O, 1/l/I): printed once, never retrievable.
const INITIAL_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Application service for tenant-scoped teacher records and their login
 * accounts. Record status (is_active) is independent from the account status:
 * a teacher can be archived while their login stays usable, and a login can be
 * deactivated while the record stays active.
 */
export class TeachersService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: TeachersServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser, query: TeacherListQuery): PaginatedTeachersResponse {
    this.assertSchoolMaster(actor);
    const repository = createTeacherRepository(this.db, createTenantContext(actor.schoolId));
    const listOptions = {
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      limit: query.limit,
      offset: query.offset,
    };
    const items = repository.list(listOptions);

    return {
      items: items.map(toTeacherResponse),
      total: repository.count(listOptions),
      limit: query.limit,
      offset: query.offset,
    };
  }

  getProfile(actor: AuthenticatedUser, teacherId: string): TeacherProfileResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const teacher = createTeacherRepository(this.db, tenant).findById(teacherId);

    if (!teacher) {
      throw teacherNotFound();
    }

    const account = teacher.userId
      ? createUserRepository(this.db, tenant).findByIdAnyStatus(teacher.userId)
      : null;

    return {
      teacher: toTeacherResponse(teacher),
      login: account ? toLoginView(account) : null,
    };
  }

  create(
    actor: AuthenticatedUser,
    input: CreateTeacherRequest,
    requestContext: RequestAuditContext = {}
  ): TeacherResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const repository = createTeacherRepository(transaction, tenant);
      let lastError: unknown;

      for (let attempt = 0; attempt < MAX_GENERATED_CODE_ATTEMPTS; attempt += 1) {
        try {
          const code = input.code?.trim()
            ? normalizePeopleCode(input.code)
            : generatePeopleCode(
                transaction,
                tenant,
                this.now,
                () => createTeacherRepository(transaction, tenant).countAll(),
                attempt
              );

          const teacher = repository.create({
            code,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            specialization: input.specialization ?? null,
            hireDate: input.hireDate ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            address: input.address ?? null,
          });

          createAuditLogRepository(transaction, tenant).createEvent({
            actorUserId: actor.id,
            action: 'TEACHER_CREATE',
            targetType: 'teacher',
            targetId: teacher.id,
            correlationId: requestContext.correlationId ?? null,
            metadata: { code: teacher.code },
          });

          return toTeacherResponse(teacher);
        } catch (error) {
          if (!isUniqueConstraintViolation(error)) {
            throw error;
          }

          // An explicit code collision is a caller error; a generated code
          // collision is retried with the next sequence number.
          if (input.code?.trim()) {
            throw teacherCodeAlreadyExists();
          }

          lastError = error;
        }
      }

      throw lastError;
    });
  }

  update(
    actor: AuthenticatedUser,
    teacherId: string,
    input: UpdateTeacherRequest,
    requestContext: RequestAuditContext = {}
  ): TeacherResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createTeacherRepository(transaction, tenant);
      const current = repository.findById(teacherId);

      if (!current) {
        throw teacherNotFound();
      }

      // Optimistic concurrency: a stale update (recordVersion mismatch) is a
      // caller error, never a silent overwrite of a newer record.
      if (input.recordVersion !== undefined && current.recordVersion !== input.recordVersion) {
        throw teacherVersionConflict();
      }

      const updated = repository.update(teacherId, normalizeTeacherUpdate(input), updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'TEACHER_UPDATE',
        targetType: 'teacher',
        targetId: teacherId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { updatedFields: Object.keys(input) },
      });

      return toTeacherResponse(updated);
    });
  }

  archive(
    actor: AuthenticatedUser,
    teacherId: string,
    input: ArchiveTeacherRequest,
    requestContext: RequestAuditContext = {}
  ): TeacherResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createTeacherRepository(transaction, tenant);

      if (!repository.findById(teacherId)) {
        throw teacherNotFound();
      }

      const archived = repository.archive(teacherId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'TEACHER_ARCHIVE',
        targetType: 'teacher',
        targetId: teacherId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toTeacherResponse(archived);
    });
  }

  reactivate(
    actor: AuthenticatedUser,
    teacherId: string,
    input: ArchiveTeacherRequest,
    requestContext: RequestAuditContext = {}
  ): TeacherResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const repository = createTeacherRepository(transaction, tenant);

      if (!repository.findById(teacherId)) {
        throw teacherNotFound();
      }

      const reactivated = repository.reactivate(teacherId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'TEACHER_REACTIVATE',
        targetType: 'teacher',
        targetId: teacherId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { reason: input.reason },
      });

      return toTeacherResponse(reactivated);
    });
  }

  /**
   * Creates a TEACHER login account for a teacher record. The username is
   * derived from the name with a numeric suffix on collision; the initial
   * password is generated and returned exactly once (hashed before insert,
   * so it can never be retrieved again).
   */
  async createLogin(
    actor: AuthenticatedUser,
    teacherId: string,
    requestContext: RequestAuditContext = {}
  ): Promise<TeacherLoginCreatedResponse> {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const initialPassword = generateInitialPassword();
    const passwordHash = await hashPassword(initialPassword);
    const updatedAt = this.now().toISOString();

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return withTransaction(this.db, (transaction) => {
          const teacher = createTeacherRepository(transaction, tenant).findById(teacherId);

          if (!teacher) {
            throw teacherNotFound();
          }

          if (!teacher.isActive) {
            throw teacherLoginRequiresActiveRecord();
          }

          if (teacher.userId) {
            throw teacherLoginAlreadyExists();
          }

          const username = findUniqueUsername(
            createUserRepository(transaction, tenant),
            teacher.firstName,
            teacher.lastName
          );

          const account = createUserRepository(transaction, tenant).createUser({
            username,
            passwordHash,
            role: 'TEACHER',
          });
          createTeacherRepository(transaction, tenant).update(
            teacherId,
            { userId: account.id },
            updatedAt
          );

          createAuditLogRepository(transaction, tenant).createEvent({
            actorUserId: actor.id,
            action: 'TEACHER_LOGIN_CREATE',
            targetType: 'teacher',
            targetId: teacherId,
            correlationId: requestContext.correlationId ?? null,
            metadata: { userId: account.id, username: account.username },
          });

          return {
            userId: account.id,
            username: account.username,
            initialPassword,
          };
        });
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        if (
          err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
          err.message.includes('UNIQUE constraint failed')
        ) {
          if (attempt < 3) continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate a unique username after 3 attempts');
  }

  deactivateLogin(
    actor: AuthenticatedUser,
    teacherId: string,
    input: DeactivateTeacherLoginRequest,
    requestContext: RequestAuditContext = {}
  ): TeacherProfileResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const teacher = createTeacherRepository(transaction, tenant).findById(teacherId);

      if (!teacher) {
        throw teacherNotFound();
      }

      if (!teacher.userId) {
        throw teacherLoginNotFound();
      }

      const account = createUserRepository(transaction, tenant).deactivate(
        teacher.userId,
        updatedAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'TEACHER_LOGIN_DEACTIVATE',
        targetType: 'teacher',
        targetId: teacherId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { userId: teacher.userId, reason: input.reason },
      });

      return {
        teacher: toTeacherResponse(teacher),
        login: toLoginView(account),
      };
    });
  }

  reactivateLogin(
    actor: AuthenticatedUser,
    teacherId: string,
    requestContext: RequestAuditContext = {}
  ): TeacherProfileResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const teacher = createTeacherRepository(transaction, tenant).findById(teacherId);

      if (!teacher) {
        throw teacherNotFound();
      }

      if (!teacher.userId) {
        throw teacherLoginNotFound();
      }

      const account = createUserRepository(transaction, tenant).reactivate(
        teacher.userId,
        updatedAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'TEACHER_LOGIN_REACTIVATE',
        targetType: 'teacher',
        targetId: teacherId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { userId: teacher.userId },
      });

      return {
        teacher: toTeacherResponse(teacher),
        login: toLoginView(account),
      };
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw peopleForbidden();
    }
  }
}

function normalizeTeacherUpdate(input: UpdateTeacherRequest): UpdateTeacherInput {
  return {
    ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
    ...(input.specialization !== undefined ? { specialization: input.specialization ?? null } : {}),
    ...(input.hireDate !== undefined ? { hireDate: input.hireDate ?? null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
  };
}

/** `Jean-Pierre Ndjambé` -> `jean.pierre.ndjambe`, suffixing on collision. */
function findUniqueUsername(
  userRepository: ReturnType<typeof createUserRepository>,
  firstName: string,
  lastName: string
) {
  const firstNamePart = normalizeUsernamePart(firstName);
  const lastNamePart = normalizeUsernamePart(lastName);
  const base = [firstNamePart, lastNamePart].filter(Boolean).join('.') || 'professeur';
  let username = base;
  let suffix = 2;

  while (userRepository.findByUsername(username)) {
    username = `${base}${String(suffix)}`;
    suffix += 1;
  }

  return username;
}

function normalizeUsernamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function generateInitialPassword(length = 12) {
  const bytes = randomBytes(length);
  let password = '';

  for (let index = 0; index < length; index += 1) {
    password += INITIAL_PASSWORD_ALPHABET.charAt(
      (bytes[index] ?? 0) % INITIAL_PASSWORD_ALPHABET.length
    );
  }

  return password;
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
