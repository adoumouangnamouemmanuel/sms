import {
  ACADEMIC_YEAR_STATUSES,
  ASSESSMENT_OCCURRENCE_MODES,
  AUTH_USER_ROLES,
  CONFIG_LIFECYCLE_STATUSES,
  DERIVED_OPERATIONS,
  ENROLLMENT_STATUSES,
  GUARDIAN_RELATIONSHIP_TYPES,
  IMPLEMENTED_SCHOOL_MODULES,
  IMPORT_KINDS,
  PERSON_SEX_VALUES,
  POLICY_SCOPE_TYPES,
  ROUNDING_MODES,
  SCHOOL_SETUP_STATUSES,
  SUBJECT_CATEGORIES,
  type AssessmentOccurrenceMode,
  type AuthUserRole,
  type ConfigLifecycleStatus,
  type DerivedOperation,
  type ImportKind,
  type PolicyScopeType,
  type RoundingMode,
  type SchoolModuleName,
  type SchoolSetupStatus,
} from '@edutrack/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  type AnySQLiteColumn,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const currentTimestamp = sql`CURRENT_TIMESTAMP`;

export const userRoles = AUTH_USER_ROLES;
export type UserRole = AuthUserRole;
export const schoolSetupStatuses = SCHOOL_SETUP_STATUSES;
export const schoolModuleNames = IMPLEMENTED_SCHOOL_MODULES;
export const personSexValues = PERSON_SEX_VALUES;
export type PersonSex = (typeof personSexValues)[number];
export const importKinds = IMPORT_KINDS;
// Re-exported directly (not redefined) so the shared type stays canonical.
export type { ImportKind };
export const guardianRelationshipTypes = GUARDIAN_RELATIONSHIP_TYPES;
export type GuardianRelationshipType = (typeof guardianRelationshipTypes)[number];
export const subjectCategories = SUBJECT_CATEGORIES;
export type SubjectCategory = (typeof subjectCategories)[number];
export const enrollmentStatuses = ENROLLMENT_STATUSES;
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];
export const academicYearStatuses = ACADEMIC_YEAR_STATUSES;
export type AcademicYearStatus = (typeof academicYearStatuses)[number];
export const assessmentOccurrenceModes = ASSESSMENT_OCCURRENCE_MODES;
export const derivedOperations = DERIVED_OPERATIONS;
export const roundingModes = ROUNDING_MODES;
export const policyScopeTypes = POLICY_SCOPE_TYPES;
export const configLifecycleStatuses = CONFIG_LIFECYCLE_STATUSES;
// Re-exported directly (not redefined) so the shared types stay canonical.
export type {
  AssessmentOccurrenceMode,
  ConfigLifecycleStatus,
  DerivedOperation,
  PolicyScopeType,
  RoundingMode,
};

export const auditOutcomes = ['SUCCESS', 'FAILURE'] as const;
export type AuditOutcome = (typeof auditOutcomes)[number];

export const school = sqliteTable(
  'school',
  {
    id: uuidPrimaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name'),
    logoUrl: text('logo_url'),
    address: text('address'),
    city: text('city'),
    country: text('country').notNull().default('TD'),
    phone: text('phone'),
    email: text('email'),
    motto: text('motto'),
    ministryCode: text('ministry_code'),
    locale: text('locale').notNull().default('fr'),
    timezone: text('timezone').notNull().default('Africa/Ndjamena'),
    currency: text('currency').notNull().default('XAF'),
    setupStatus: text('setup_status').$type<SchoolSetupStatus>().notNull().default('PENDING'),
    ...recordLifecycleColumns(),
  },
  (table) => [uniqueIndex('school_code_unique').on(table.code)]
);

export const academicYear = sqliteTable(
  'academic_year',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    label: text('label').notNull(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    status: text('status').$type<AcademicYearStatus>().notNull().default('ACTIVE'),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('academic_year_school_id_idx').on(table.schoolId),
    uniqueIndex('academic_year_school_current_unique')
      .on(table.schoolId)
      .where(sql`${table.isCurrent} = true`),
    // Exactly one ACTIVE year per school (migration 0018). Existing rows
    // defaulted to ACTIVE were backfilled to CLOSED unless current.
    uniqueIndex('academic_year_school_active_unique')
      .on(table.schoolId)
      .where(sql`${table.status} = 'ACTIVE' AND ${table.deletedAt} is null`),
    uniqueIndex('academic_year_school_label_unique')
      .on(table.schoolId, table.label)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('academic_year_school_id_id_unique').on(table.schoolId, table.id),
    check('academic_year_status_check', sql`${table.status} in ('DRAFT', 'ACTIVE', 'CLOSED')`),
  ]
);

export const term = sqliteTable(
  'term',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    academicYearId: text('academic_year_id').notNull(),
    label: text('label').notNull(),
    termNumber: integer('term_number').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('term_school_id_idx').on(table.schoolId),
    index('term_academic_year_id_idx').on(table.academicYearId),
    uniqueIndex('term_academic_year_current_unique')
      .on(table.academicYearId)
      .where(sql`${table.isCurrent} = true`),
    uniqueIndex('term_school_current_unique')
      .on(table.schoolId)
      .where(sql`${table.isCurrent} = true`),
    uniqueIndex('term_academic_year_label_unique')
      .on(table.academicYearId, table.label)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('term_academic_year_number_unique')
      .on(table.academicYearId, table.termNumber)
      .where(sql`${table.deletedAt} is null`),
    check('term_number_check', sql`${table.termNumber} >= 1`),
    check('term_date_range_check', sql`${table.startDate} <= ${table.endDate}`),
    foreignKey({
      columns: [table.schoolId, table.academicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const classLevel = sqliteTable(
  'class_level',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    displayOrder: integer('display_order').notNull(),
    isExamYear: integer('is_exam_year', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('class_level_school_id_idx').on(table.schoolId),
    // Referenced by the composite tenant FKs from `classroom` (school_id, id).
    uniqueIndex('class_level_school_id_id_unique').on(table.schoolId, table.id),
    uniqueIndex('class_level_school_code_unique')
      .on(table.schoolId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('class_level_school_name_unique')
      .on(table.schoolId, table.name)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('class_level_school_order_unique')
      .on(table.schoolId, table.displayOrder)
      .where(sql`${table.deletedAt} is null`),
    check('class_level_display_order_check', sql`${table.displayOrder} >= 1`),
  ]
);

export const schoolModuleConfig = sqliteTable(
  'school_module_config',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    moduleName: text('module_name').$type<SchoolModuleName>().notNull(),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
    configJson: text('config_json').notNull().default('{}'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('school_module_config_school_id_idx').on(table.schoolId),
    uniqueIndex('school_module_config_school_module_unique').on(table.schoolId, table.moduleName),
    check(
      'school_module_config_module_name_check',
      sql`${table.moduleName} in ('SCHOOL_SETUP', 'ACADEMIC_STRUCTURE', 'STUDENTS', 'TEACHERS', 'CLASSES', 'CONFIGURATION')`
    ),
  ]
);

export const user = sqliteTable(
  'user',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').$type<UserRole>().notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    lastLoginAt: text('last_login_at'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('user_school_id_idx').on(table.schoolId),
    uniqueIndex('user_school_id_id_unique').on(table.schoolId, table.id),
    uniqueIndex('user_school_username_unique').on(table.schoolId, table.username),
    check('user_role_check', sql`${table.role} in ('SCHOOL_MASTER', 'TEACHER')`),
  ]
);

export const student = sqliteTable(
  'student',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    code: text('code').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    sex: text('sex').$type<PersonSex>(),
    dateOfBirth: text('date_of_birth'),
    placeOfBirth: text('place_of_birth'),
    nationality: text('nationality'),
    photoUrl: text('photo_url'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('student_school_id_idx').on(table.schoolId),
    index('student_school_last_name_idx').on(table.schoolId, table.lastName),
    // Codes are durable identity for official records: strictly unique per school, never reused.
    uniqueIndex('student_school_code_unique').on(table.schoolId, table.code),
    uniqueIndex('student_school_id_id_unique').on(table.schoolId, table.id),
    check('student_sex_check', sql`${table.sex} in ('M', 'F', 'AUTRE')`),
  ]
);

export const teacher = sqliteTable(
  'teacher',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    code: text('code').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    specialization: text('specialization'),
    hireDate: text('hire_date'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    // Optional login link: record status (is_active) stays independent of the account status.
    userId: text('user_id'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('teacher_school_id_idx').on(table.schoolId),
    index('teacher_school_last_name_idx').on(table.schoolId, table.lastName),
    // Codes are durable identity: strictly unique per school, never reused.
    uniqueIndex('teacher_school_code_unique').on(table.schoolId, table.code),
    uniqueIndex('teacher_school_id_id_unique').on(table.schoolId, table.id),
    foreignKey({
      columns: [table.schoolId, table.userId],
      foreignColumns: [user.schoolId, user.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const guardian = sqliteTable(
  'guardian',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('guardian_school_id_idx').on(table.schoolId),
    index('guardian_school_last_name_idx').on(table.schoolId, table.lastName),
    uniqueIndex('guardian_school_id_id_unique').on(table.schoolId, table.id),
  ]
);

export const studentGuardian = sqliteTable(
  'student_guardian',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    studentId: text('student_id').notNull(),
    guardianId: text('guardian_id').notNull(),
    relationshipType: text('relationship_type').$type<GuardianRelationshipType>().notNull(),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    isEmergency: integer('is_emergency', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('student_guardian_school_id_idx').on(table.schoolId),
    index('student_guardian_student_id_idx').on(table.studentId),
    index('student_guardian_guardian_id_idx').on(table.guardianId),
    uniqueIndex('student_guardian_school_student_guardian_unique')
      .on(table.schoolId, table.studentId, table.guardianId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('student_guardian_student_primary_unique')
      .on(table.schoolId, table.studentId)
      .where(sql`${table.isPrimary} = true AND ${table.deletedAt} is null`),
    foreignKey({
      columns: [table.schoolId, table.studentId],
      foreignColumns: [student.schoolId, student.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.guardianId],
      foreignColumns: [guardian.schoolId, guardian.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check(
      'student_guardian_relationship_type_check',
      sql`${table.relationshipType} in ('PERE', 'MERE', 'TUTEUR', 'AUTRE')`
    ),
  ]
);

export const importBatch = sqliteTable(
  'import_batch',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    kind: text('kind').$type<ImportKind>().notNull(),
    importIdentifier: text('import_identifier').notNull(),
    filename: text('filename').notNull(),
    totalRows: integer('total_rows').notNull(),
    validRows: integer('valid_rows').notNull(),
    errorRows: integer('error_rows').notNull(),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('import_batch_school_id_idx').on(table.schoolId),
    // Re-importing the same identifier is a no-op (idempotent confirmed imports).
    uniqueIndex('import_batch_school_identifier_unique').on(table.schoolId, table.importIdentifier),
    check(
      'import_batch_kind_check',
      sql`${table.kind} in ('STUDENTS', 'TEACHERS', 'GUARDIANS', 'SUBJECTS', 'CLASSROOMS', 'CLASS_SUBJECTS')`
    ),
  ]
);

export const refreshSession = sqliteTable(
  'refresh_session',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    familyId: text('family_id').notNull(),
    replacedBySessionId: text('replaced_by_session_id').references(
      (): AnySQLiteColumn => refreshSession.id,
      {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }
    ),
    deviceName: text('device_name'),
    userAgentHash: text('user_agent_hash'),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('refresh_session_school_id_idx').on(table.schoolId),
    index('refresh_session_user_id_idx').on(table.userId),
    index('refresh_session_family_id_idx').on(table.familyId),
    uniqueIndex('refresh_session_token_hash_unique').on(table.tokenHash),
    index('refresh_session_replaced_by_idx').on(table.replacedBySessionId),
  ]
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    correlationId: text('correlation_id'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    outcome: text('outcome').$type<AuditOutcome>().notNull().default('SUCCESS'),
    occurredAt: text('occurred_at').notNull().default(currentTimestamp),
  },
  (table) => [
    index('audit_log_school_id_idx').on(table.schoolId),
    index('audit_log_actor_user_id_idx').on(table.actorUserId),
    index('audit_log_target_idx').on(table.targetType, table.targetId),
    check('audit_log_outcome_check', sql`${table.outcome} in ('SUCCESS', 'FAILURE')`),
  ]
);

export const subject = sqliteTable(
  'subject',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    nameAr: text('name_ar'),
    shortLabel: text('short_label'),
    category: text('category').$type<SubjectCategory>().notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('subject_school_id_idx').on(table.schoolId),
    uniqueIndex('subject_school_code_unique')
      .on(table.schoolId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('subject_school_id_id_unique').on(table.schoolId, table.id),
    check(
      'subject_category_check',
      sql`${table.category} in ('LANGUES', 'SCIENCES', 'MATHEMATIQUES', 'SCIENCES_SOCIALES', 'ARTS', 'SPORTS', 'AUTRE')`
    ),
  ]
);

export const classroom = sqliteTable(
  'classroom',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    academicYearId: text('academic_year_id').notNull(),
    classLevelId: text('class_level_id').notNull(),
    code: text('code').notNull(),
    name: text('name'),
    capacity: integer('capacity'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('classroom_school_id_idx').on(table.schoolId),
    index('classroom_academic_year_id_idx').on(table.academicYearId),
    index('classroom_class_level_id_idx').on(table.classLevelId),
    // The tenant/year code identifies the cohort (e.g. 3E-A); a soft-deleted
    // classroom frees its code for reuse.
    uniqueIndex('classroom_school_year_code_unique')
      .on(table.schoolId, table.academicYearId, table.code)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('classroom_school_id_id_unique').on(table.schoolId, table.id),
    check('classroom_capacity_check', sql`${table.capacity} is null OR ${table.capacity} >= 1`),
    foreignKey({
      columns: [table.schoolId, table.academicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.classLevelId],
      foreignColumns: [classLevel.schoolId, classLevel.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const classSubject = sqliteTable(
  'class_subject',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    classroomId: text('classroom_id').notNull(),
    subjectId: text('subject_id').notNull(),
    coefficient: integer('coefficient').notNull(),
    isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
    teacherId: text('teacher_id'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('class_subject_school_id_idx').on(table.schoolId),
    index('class_subject_classroom_id_idx').on(table.classroomId),
    index('class_subject_subject_id_idx').on(table.subjectId),
    index('class_subject_teacher_id_idx').on(table.teacherId),
    // The classroom/subject pair is tenant-locally unique in the academic context.
    uniqueIndex('class_subject_school_classroom_subject_unique')
      .on(table.schoolId, table.classroomId, table.subjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('class_subject_school_id_id_unique').on(table.schoolId, table.id),
    check('class_subject_coefficient_check', sql`${table.coefficient} >= 1`),
    foreignKey({
      columns: [table.schoolId, table.classroomId],
      foreignColumns: [classroom.schoolId, classroom.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.subjectId],
      foreignColumns: [subject.schoolId, subject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.teacherId],
      foreignColumns: [teacher.schoolId, teacher.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const levelSubject = sqliteTable(
  'level_subject',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    classLevelId: text('class_level_id').notNull(),
    subjectId: text('subject_id').notNull(),
    coefficient: integer('coefficient').notNull(),
    isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('level_subject_school_id_idx').on(table.schoolId),
    index('level_subject_class_level_id_idx').on(table.classLevelId),
    index('level_subject_subject_id_idx').on(table.subjectId),
    uniqueIndex('level_subject_school_level_subject_unique')
      .on(table.schoolId, table.classLevelId, table.subjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('level_subject_school_id_id_unique').on(table.schoolId, table.id),
    check('level_subject_coefficient_check', sql`${table.coefficient} >= 1`),
    foreignKey({
      columns: [table.schoolId, table.classLevelId],
      foreignColumns: [classLevel.schoolId, classLevel.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.subjectId],
      foreignColumns: [subject.schoolId, subject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const subjectGroup = sqliteTable(
  'subject_group',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    nameAr: text('name_ar'),
    displayOrder: integer('display_order').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('subject_group_school_id_idx').on(table.schoolId),
    uniqueIndex('subject_group_school_name_unique')
      .on(table.schoolId, table.name)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('subject_group_school_order_unique')
      .on(table.schoolId, table.displayOrder)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('subject_group_school_id_id_unique').on(table.schoolId, table.id),
    check('subject_group_display_order_check', sql`${table.displayOrder} >= 1`),
  ]
);

export const subjectGroupMember = sqliteTable(
  'subject_group_member',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    subjectGroupId: text('subject_group_id').notNull(),
    subjectId: text('subject_id').notNull(),
    displayOrder: integer('display_order').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('subject_group_member_school_id_idx').on(table.schoolId),
    index('subject_group_member_group_id_idx').on(table.subjectGroupId),
    index('subject_group_member_subject_id_idx').on(table.subjectId),
    uniqueIndex('subject_group_member_school_group_subject_unique')
      .on(table.schoolId, table.subjectGroupId, table.subjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('subject_group_member_school_group_order_unique')
      .on(table.schoolId, table.subjectGroupId, table.displayOrder)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('subject_group_member_school_id_id_unique').on(table.schoolId, table.id),
    check('subject_group_member_display_order_check', sql`${table.displayOrder} >= 1`),
    foreignKey({
      columns: [table.schoolId, table.subjectGroupId],
      foreignColumns: [subjectGroup.schoolId, subjectGroup.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.subjectId],
      foreignColumns: [subject.schoolId, subject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const classEnrollment = sqliteTable(
  'class_enrollment',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    studentId: text('student_id').notNull(),
    classroomId: text('classroom_id').notNull(),
    academicYearId: text('academic_year_id').notNull(),
    status: text('status').$type<EnrollmentStatus>().notNull().default('ACTIVE'),
    enrollmentDate: text('enrollment_date').notNull(),
    exitDate: text('exit_date'),
    reason: text('reason'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('class_enrollment_school_id_idx').on(table.schoolId),
    index('class_enrollment_student_id_idx').on(table.studentId),
    index('class_enrollment_classroom_id_idx').on(table.classroomId),
    index('class_enrollment_academic_year_id_idx').on(table.academicYearId),
    // Only live rows count as duplicates: a transfer back to a previous
    // classroom must not collide with the retained TRANSFERRED history row.
    uniqueIndex('class_enrollment_school_classroom_student_unique')
      .on(table.schoolId, table.classroomId, table.studentId)
      .where(sql`${table.status} = 'ACTIVE' AND ${table.deletedAt} is null`),
    // AGENTS.md §9.3: a student has at most one ACTIVE class enrollment per year.
    uniqueIndex('class_enrollment_school_student_year_active_unique')
      .on(table.schoolId, table.studentId, table.academicYearId)
      .where(sql`${table.status} = 'ACTIVE' AND ${table.deletedAt} is null`),
    uniqueIndex('class_enrollment_school_id_id_unique').on(table.schoolId, table.id),
    check(
      'class_enrollment_status_check',
      sql`${table.status} in ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED', 'PROMOTED')`
    ),
    foreignKey({
      columns: [table.schoolId, table.studentId],
      foreignColumns: [student.schoolId, student.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.classroomId],
      foreignColumns: [classroom.schoolId, classroom.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.academicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    // Migration 0016 pins the enrollment to the classroom's actual academic
    // year (a row can never reference a classroom from a different year) via
    // BEFORE INSERT/UPDATE triggers, because SQLite cannot add a FOREIGN KEY
    // to an existing table. Kept out of the schema so generated migrations
    // stay aligned with the real database state.
    // See 0016_class_enrollment_consistency.sql.
  ]
);

export const studentSubjectEnrollment = sqliteTable(
  'student_subject_enrollment',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    classEnrollmentId: text('class_enrollment_id').notNull(),
    classSubjectId: text('class_subject_id').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('student_subject_enrollment_school_id_idx').on(table.schoolId),
    index('student_subject_enrollment_class_enrollment_id_idx').on(table.classEnrollmentId),
    index('student_subject_enrollment_class_subject_id_idx').on(table.classSubjectId),
    uniqueIndex('student_subject_enrollment_school_enrollment_subject_unique')
      .on(table.schoolId, table.classEnrollmentId, table.classSubjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('student_subject_enrollment_school_id_id_unique').on(table.schoolId, table.id),
    foreignKey({
      columns: [table.schoolId, table.classEnrollmentId],
      foreignColumns: [classEnrollment.schoolId, classEnrollment.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.classSubjectId],
      foreignColumns: [classSubject.schoolId, classSubject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

// ---------------------------------------------------------------------------
// Grading-policy model (roadmap §9.7-§9.10, design §6-§14)
//
// A grading policy is a versioned document: `logical_policy_id` groups the
// versions of one conceptual policy, `version` numbers them, and the status
// follows `DRAFT -> PUBLISHED -> SUPERSEDED`. Published documents are
// immutable - edits create a new version (the API duplicate endpoint). The
// calculation graph (assessment types -> derived results -> one subject
// result) is validated by the pure domain before publication; the schema
// enforces the structural invariants (occurrence ranges, weight sanity,
// scope uniqueness).
// ---------------------------------------------------------------------------

export const gradingPolicy = sqliteTable(
  'grading_policy',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    logicalPolicyId: text('logical_policy_id').notNull(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<ConfigLifecycleStatus>().notNull().default('DRAFT'),
    scaleMax: integer('scale_max').notNull(),
    /** Pass threshold in hundredths (1000 = 10.00 on a /20 scale). */
    passThreshold: integer('pass_threshold').notNull(),
    decimalPrecision: integer('decimal_precision').notNull().default(2),
    roundingMode: text('rounding_mode').$type<RoundingMode>().notNull().default('HALF_UP'),
    effectiveAcademicYearId: text('effective_academic_year_id'),
    createdBy: text('created_by'),
    publishedBy: text('published_by'),
    publishedAt: text('published_at'),
    supersedesPolicyId: text('supersedes_policy_id'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('grading_policy_school_id_idx').on(table.schoolId),
    index('grading_policy_logical_policy_id_idx').on(table.logicalPolicyId),
    uniqueIndex('grading_policy_school_id_id_unique').on(table.schoolId, table.id),
    uniqueIndex('grading_policy_school_logical_version_unique').on(
      table.schoolId,
      table.logicalPolicyId,
      table.version
    ),
    check(
      'grading_policy_scale_max_check',
      sql`${table.scaleMax} >= 1 AND ${table.scaleMax} <= 100`
    ),
    check('grading_policy_pass_threshold_check', sql`${table.passThreshold} >= 0`),
    check(
      'grading_policy_status_check',
      sql`${table.status} in ('DRAFT', 'PUBLISHED', 'SUPERSEDED')`
    ),
    check('grading_policy_rounding_check', sql`${table.roundingMode} in ('HALF_UP', 'TRUNCATE')`),
    foreignKey({
      columns: [table.schoolId, table.effectiveAcademicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const assessmentTypeDefinition = sqliteTable(
  'assessment_type_definition',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    gradingPolicyId: text('grading_policy_id').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    scaleMax: integer('scale_max').notNull(),
    occurrenceMode: text('occurrence_mode').$type<AssessmentOccurrenceMode>().notNull(),
    minOccurrences: integer('min_occurrences').notNull(),
    maxOccurrences: integer('max_occurrences').notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(true),
    teacherCanCreateInstances: integer('teacher_can_create_instances', { mode: 'boolean' })
      .notNull()
      .default(true),
    displayOrder: integer('display_order').notNull().default(0),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('assessment_type_definition_school_id_idx').on(table.schoolId),
    index('assessment_type_definition_grading_policy_id_idx').on(table.gradingPolicyId),
    uniqueIndex('assessment_type_definition_school_id_id_unique').on(table.schoolId, table.id),
    check(
      'assessment_type_definition_occurrence_mode_check',
      sql`${table.occurrenceMode} in ('SINGLE', 'REPEATABLE')`
    ),
    check('assessment_type_definition_scale_max_check', sql`${table.scaleMax} >= 1`),
    check('assessment_type_definition_min_occurrences_check', sql`${table.minOccurrences} >= 0`),
    check(
      'assessment_type_definition_max_occurrences_check',
      sql`${table.maxOccurrences} >= ${table.minOccurrences}`
    ),
    foreignKey({
      columns: [table.schoolId, table.gradingPolicyId],
      foreignColumns: [gradingPolicy.schoolId, gradingPolicy.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const derivedResultDefinition = sqliteTable(
  'derived_result_definition',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    gradingPolicyId: text('grading_policy_id').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    operation: text('operation').$type<DerivedOperation>().notNull(),
    /** Source assessment-type definition ids (JSON array of strings). */
    sourceDefinitionIds: text('source_definition_ids').notNull(),
    precision: integer('precision').notNull().default(2),
    roundingMode: text('rounding_mode').$type<RoundingMode>().notNull().default('HALF_UP'),
    displayOrder: integer('display_order').notNull().default(0),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('derived_result_definition_school_id_idx').on(table.schoolId),
    index('derived_result_definition_grading_policy_id_idx').on(table.gradingPolicyId),
    uniqueIndex('derived_result_definition_school_id_id_unique').on(table.schoolId, table.id),
    check('derived_result_definition_operation_check', sql`${table.operation} in ('MEAN')`),
    check(
      'derived_result_definition_rounding_check',
      sql`${table.roundingMode} in ('HALF_UP', 'TRUNCATE')`
    ),
    foreignKey({
      columns: [table.schoolId, table.gradingPolicyId],
      foreignColumns: [gradingPolicy.schoolId, gradingPolicy.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const subjectResultDefinition = sqliteTable(
  'subject_result_definition',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    gradingPolicyId: text('grading_policy_id').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    precision: integer('precision').notNull().default(2),
    roundingMode: text('rounding_mode').$type<RoundingMode>().notNull().default('HALF_UP'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('subject_result_definition_school_id_idx').on(table.schoolId),
    index('subject_result_definition_grading_policy_id_idx').on(table.gradingPolicyId),
    uniqueIndex('subject_result_definition_school_id_id_unique').on(table.schoolId, table.id),
    uniqueIndex('subject_result_definition_school_policy_unique')
      .on(table.schoolId, table.gradingPolicyId)
      .where(sql`${table.deletedAt} is null`),
    check(
      'subject_result_definition_rounding_check',
      sql`${table.roundingMode} in ('HALF_UP', 'TRUNCATE')`
    ),
    foreignKey({
      columns: [table.schoolId, table.gradingPolicyId],
      foreignColumns: [gradingPolicy.schoolId, gradingPolicy.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const subjectResultInput = sqliteTable(
  'subject_result_input',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    subjectResultDefinitionId: text('subject_result_definition_id').notNull(),
    /** Source id: an assessment type OR a derived result (polymorphic). */
    sourceDefinitionId: text('source_definition_id').notNull(),
    /** Weight in hundredths of a percent (5000 = 50%). */
    weight: integer('weight').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('subject_result_input_school_id_idx').on(table.schoolId),
    index('subject_result_input_subject_result_definition_id_idx').on(
      table.subjectResultDefinitionId
    ),
    uniqueIndex('subject_result_input_school_id_id_unique').on(table.schoolId, table.id),
    check('subject_result_input_weight_check', sql`${table.weight} > 0`),
    foreignKey({
      columns: [table.schoolId, table.subjectResultDefinitionId],
      foreignColumns: [subjectResultDefinition.schoolId, subjectResultDefinition.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const policyScope = sqliteTable(
  'policy_scope',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    gradingPolicyId: text('grading_policy_id').notNull(),
    scopeType: text('scope_type').$type<PolicyScopeType>().notNull(),
    classLevelId: text('class_level_id'),
    subjectId: text('subject_id'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('policy_scope_school_id_idx').on(table.schoolId),
    index('policy_scope_grading_policy_id_idx').on(table.gradingPolicyId),
    uniqueIndex('policy_scope_school_id_id_unique').on(table.schoolId, table.id),
    // One scope slot per school/level/subject. NULLs are distinct in SQLite
    // unique indexes, so each scope type gets its own partial index.
    uniqueIndex('policy_scope_school_default_unique')
      .on(table.schoolId)
      .where(sql`${table.scopeType} = 'SCHOOL_DEFAULT' AND ${table.deletedAt} is null`),
    uniqueIndex('policy_scope_level_unique')
      .on(table.schoolId, table.classLevelId)
      .where(sql`${table.scopeType} = 'LEVEL' AND ${table.deletedAt} is null`),
    uniqueIndex('policy_scope_level_subject_unique')
      .on(table.schoolId, table.classLevelId, table.subjectId)
      .where(sql`${table.scopeType} = 'LEVEL_SUBJECT' AND ${table.deletedAt} is null`),
    check(
      'policy_scope_type_check',
      sql`${table.scopeType} in ('SCHOOL_DEFAULT', 'LEVEL', 'LEVEL_SUBJECT')`
    ),
    // A scope slot must be populated consistently: SCHOOL_DEFAULT carries no
    // ids, LEVEL carries exactly a level, LEVEL_SUBJECT carries both.
    check(
      'policy_scope_shape_check',
      sql`(
        (${table.scopeType} = 'SCHOOL_DEFAULT' AND ${table.classLevelId} IS NULL AND ${table.subjectId} IS NULL)
        OR
        (${table.scopeType} = 'LEVEL' AND ${table.classLevelId} IS NOT NULL AND ${table.subjectId} IS NULL)
        OR
        (${table.scopeType} = 'LEVEL_SUBJECT' AND ${table.classLevelId} IS NOT NULL AND ${table.subjectId} IS NOT NULL)
      )`
    ),
    foreignKey({
      columns: [table.schoolId, table.gradingPolicyId],
      foreignColumns: [gradingPolicy.schoolId, gradingPolicy.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.classLevelId],
      foreignColumns: [classLevel.schoolId, classLevel.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.schoolId, table.subjectId],
      foreignColumns: [subject.schoolId, subject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const appreciationScale = sqliteTable(
  'appreciation_scale',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    logicalScaleId: text('logical_scale_id').notNull(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<ConfigLifecycleStatus>().notNull().default('DRAFT'),
    scaleMax: integer('scale_max').notNull(),
    publishedAt: text('published_at'),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('appreciation_scale_school_id_idx').on(table.schoolId),
    index('appreciation_scale_logical_scale_id_idx').on(table.logicalScaleId),
    uniqueIndex('appreciation_scale_school_id_id_unique').on(table.schoolId, table.id),
    // Version identity per logical scale, mirroring grading_policy's
    // (school_id, logical_policy_id, version) protection.
    uniqueIndex('appreciation_scale_school_logical_version_unique').on(
      table.schoolId,
      table.logicalScaleId,
      table.version
    ),
    check(
      'appreciation_scale_status_check',
      sql`${table.status} in ('DRAFT', 'PUBLISHED', 'SUPERSEDED')`
    ),
    check('appreciation_scale_scale_max_check', sql`${table.scaleMax} >= 1`),
  ]
);

export const appreciationBand = sqliteTable(
  'appreciation_band',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    appreciationScaleId: text('appreciation_scale_id').notNull(),
    /** Inclusive bounds in hundredths (1600 = 16.00). */
    lowerBound: integer('lower_bound').notNull(),
    upperBound: integer('upper_bound').notNull(),
    labelFr: text('label_fr').notNull(),
    labelAr: text('label_ar').notNull(),
    labelEn: text('label_en').notNull(),
    shortLabel: text('short_label').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    ...recordLifecycleColumns(),
  },
  (table) => [
    index('appreciation_band_school_id_idx').on(table.schoolId),
    index('appreciation_band_appreciation_scale_id_idx').on(table.appreciationScaleId),
    uniqueIndex('appreciation_band_school_id_id_unique').on(table.schoolId, table.id),
    check('appreciation_band_lower_bound_check', sql`${table.lowerBound} >= 0`),
    check('appreciation_band_upper_bound_check', sql`${table.upperBound} >= ${table.lowerBound}`),
    foreignKey({
      columns: [table.schoolId, table.appreciationScaleId],
      foreignColumns: [appreciationScale.schoolId, appreciationScale.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ]
);

export const schemaMetadata = sqliteTable('schema_metadata', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default(currentTimestamp),
  updatedAt: text('updated_at').notNull().default(currentTimestamp),
  recordVersion: integer('record_version').notNull().default(1),
});

function uuidPrimaryKey() {
  return text('id').primaryKey().notNull();
}

function tenantColumns() {
  return {
    schoolId: text('school_id')
      .notNull()
      .references(() => school.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
  };
}

function recordLifecycleColumns() {
  return {
    createdAt: text('created_at').notNull().default(currentTimestamp),
    updatedAt: text('updated_at').notNull().default(currentTimestamp),
    recordVersion: integer('record_version').notNull().default(1),
    deletedAt: text('deleted_at'),
  };
}
