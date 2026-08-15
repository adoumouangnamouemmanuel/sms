import {
  AUTH_USER_ROLES,
  ENROLLMENT_STATUSES,
  GUARDIAN_RELATIONSHIP_TYPES,
  IMPLEMENTED_SCHOOL_MODULES,
  IMPORT_KINDS,
  PERSON_SEX_VALUES,
  SCHOOL_SETUP_STATUSES,
  SUBJECT_CATEGORIES,
  type AuthUserRole,
  type ImportKind,
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
  (table) => ({
    codeUnique: uniqueIndex('school_code_unique').on(table.code),
  })
);

export const academicYear = sqliteTable(
  'academic_year',
  {
    id: uuidPrimaryKey(),
    ...tenantColumns(),
    label: text('label').notNull(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
    ...recordLifecycleColumns(),
  },
  (table) => ({
    schoolIdIdx: index('academic_year_school_id_idx').on(table.schoolId),
    schoolCurrentUnique: uniqueIndex('academic_year_school_current_unique')
      .on(table.schoolId)
      .where(sql`${table.isCurrent} = true`),
    schoolLabelUnique: uniqueIndex('academic_year_school_label_unique')
      .on(table.schoolId, table.label)
      .where(sql`${table.deletedAt} is null`),
    schoolIdIdUnique: uniqueIndex('academic_year_school_id_id_unique').on(table.schoolId, table.id),
  })
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
  (table) => ({
    schoolIdIdx: index('term_school_id_idx').on(table.schoolId),
    academicYearIdIdx: index('term_academic_year_id_idx').on(table.academicYearId),
    academicYearCurrentUnique: uniqueIndex('term_academic_year_current_unique')
      .on(table.academicYearId)
      .where(sql`${table.isCurrent} = true`),
    schoolCurrentUnique: uniqueIndex('term_school_current_unique')
      .on(table.schoolId)
      .where(sql`${table.isCurrent} = true`),
    academicYearLabelUnique: uniqueIndex('term_academic_year_label_unique')
      .on(table.academicYearId, table.label)
      .where(sql`${table.deletedAt} is null`),
    academicYearNumberUnique: uniqueIndex('term_academic_year_number_unique')
      .on(table.academicYearId, table.termNumber)
      .where(sql`${table.deletedAt} is null`),
    numberCheck: check('term_number_check', sql`${table.termNumber} >= 1`),
    dateRangeCheck: check('term_date_range_check', sql`${table.startDate} <= ${table.endDate}`),
    academicYearFk: foreignKey({
      columns: [table.schoolId, table.academicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  })
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
  (table) => ({
    schoolIdIdx: index('class_level_school_id_idx').on(table.schoolId),
    // Referenced by the composite tenant FKs from `classroom` (school_id, id).
    schoolIdIdUnique: uniqueIndex('class_level_school_id_id_unique').on(table.schoolId, table.id),
    schoolCodeUnique: uniqueIndex('class_level_school_code_unique')
      .on(table.schoolId, table.code)
      .where(sql`${table.deletedAt} is null`),
    schoolNameUnique: uniqueIndex('class_level_school_name_unique')
      .on(table.schoolId, table.name)
      .where(sql`${table.deletedAt} is null`),
    schoolOrderUnique: uniqueIndex('class_level_school_order_unique')
      .on(table.schoolId, table.displayOrder)
      .where(sql`${table.deletedAt} is null`),
    displayOrderCheck: check('class_level_display_order_check', sql`${table.displayOrder} >= 1`),
  })
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
  (table) => ({
    schoolIdIdx: index('school_module_config_school_id_idx').on(table.schoolId),
    schoolModuleUnique: uniqueIndex('school_module_config_school_module_unique').on(
      table.schoolId,
      table.moduleName
    ),
    moduleNameCheck: check(
      'school_module_config_module_name_check',
      sql`${table.moduleName} in ('SCHOOL_SETUP', 'ACADEMIC_STRUCTURE', 'STUDENTS', 'TEACHERS', 'CLASSES')`
    ),
  })
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
  (table) => ({
    schoolIdIdx: index('user_school_id_idx').on(table.schoolId),
    schoolIdIdUnique: uniqueIndex('user_school_id_id_unique').on(table.schoolId, table.id),
    schoolUsernameUnique: uniqueIndex('user_school_username_unique').on(
      table.schoolId,
      table.username
    ),
    roleCheck: check('user_role_check', sql`${table.role} in ('SCHOOL_MASTER', 'TEACHER')`),
  })
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
  (table) => ({
    schoolIdIdx: index('student_school_id_idx').on(table.schoolId),
    schoolLastNameIdx: index('student_school_last_name_idx').on(table.schoolId, table.lastName),
    // Codes are durable identity for official records: strictly unique per school, never reused.
    schoolCodeUnique: uniqueIndex('student_school_code_unique').on(table.schoolId, table.code),
    schoolIdIdUnique: uniqueIndex('student_school_id_id_unique').on(table.schoolId, table.id),
    sexCheck: check('student_sex_check', sql`${table.sex} in ('M', 'F', 'AUTRE')`),
  })
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
  (table) => ({
    schoolIdIdx: index('teacher_school_id_idx').on(table.schoolId),
    schoolLastNameIdx: index('teacher_school_last_name_idx').on(table.schoolId, table.lastName),
    // Codes are durable identity: strictly unique per school, never reused.
    schoolCodeUnique: uniqueIndex('teacher_school_code_unique').on(table.schoolId, table.code),
    schoolIdIdUnique: uniqueIndex('teacher_school_id_id_unique').on(table.schoolId, table.id),
    userFk: foreignKey({
      columns: [table.schoolId, table.userId],
      foreignColumns: [user.schoolId, user.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  })
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
  (table) => ({
    schoolIdIdx: index('guardian_school_id_idx').on(table.schoolId),
    schoolLastNameIdx: index('guardian_school_last_name_idx').on(table.schoolId, table.lastName),
    schoolIdIdUnique: uniqueIndex('guardian_school_id_id_unique').on(table.schoolId, table.id),
  })
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
  (table) => ({
    schoolIdIdx: index('student_guardian_school_id_idx').on(table.schoolId),
    studentIdIdx: index('student_guardian_student_id_idx').on(table.studentId),
    guardianIdIdx: index('student_guardian_guardian_id_idx').on(table.guardianId),
    schoolStudentGuardianUnique: uniqueIndex('student_guardian_school_student_guardian_unique')
      .on(table.schoolId, table.studentId, table.guardianId)
      .where(sql`${table.deletedAt} is null`),
    studentPrimaryUnique: uniqueIndex('student_guardian_student_primary_unique')
      .on(table.schoolId, table.studentId)
      .where(sql`${table.isPrimary} = true AND ${table.deletedAt} is null`),
    studentFk: foreignKey({
      columns: [table.schoolId, table.studentId],
      foreignColumns: [student.schoolId, student.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    guardianFk: foreignKey({
      columns: [table.schoolId, table.guardianId],
      foreignColumns: [guardian.schoolId, guardian.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    relationshipTypeCheck: check(
      'student_guardian_relationship_type_check',
      sql`${table.relationshipType} in ('PERE', 'MERE', 'TUTEUR', 'AUTRE')`
    ),
  })
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
  (table) => ({
    schoolIdIdx: index('import_batch_school_id_idx').on(table.schoolId),
    // Re-importing the same identifier is a no-op (idempotent confirmed imports).
    schoolIdentifierUnique: uniqueIndex('import_batch_school_identifier_unique').on(
      table.schoolId,
      table.importIdentifier
    ),
    kindCheck: check(
      'import_batch_kind_check',
      sql`${table.kind} in ('STUDENTS', 'TEACHERS', 'GUARDIANS', 'SUBJECTS', 'CLASSROOMS', 'CLASS_SUBJECTS')`
    ),
  })
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
  (table) => ({
    schoolIdIdx: index('refresh_session_school_id_idx').on(table.schoolId),
    userIdIdx: index('refresh_session_user_id_idx').on(table.userId),
    familyIdIdx: index('refresh_session_family_id_idx').on(table.familyId),
    tokenHashUnique: uniqueIndex('refresh_session_token_hash_unique').on(table.tokenHash),
    replacedBySessionFk: index('refresh_session_replaced_by_idx').on(table.replacedBySessionId),
  })
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
  (table) => ({
    schoolIdIdx: index('audit_log_school_id_idx').on(table.schoolId),
    actorUserIdIdx: index('audit_log_actor_user_id_idx').on(table.actorUserId),
    targetIdx: index('audit_log_target_idx').on(table.targetType, table.targetId),
    outcomeCheck: check('audit_log_outcome_check', sql`${table.outcome} in ('SUCCESS', 'FAILURE')`),
  })
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
  (table) => ({
    schoolIdIdx: index('subject_school_id_idx').on(table.schoolId),
    schoolCodeUnique: uniqueIndex('subject_school_code_unique')
      .on(table.schoolId, table.code)
      .where(sql`${table.deletedAt} is null`),
    schoolIdIdUnique: uniqueIndex('subject_school_id_id_unique').on(table.schoolId, table.id),
    categoryCheck: check(
      'subject_category_check',
      sql`${table.category} in ('LANGUES', 'SCIENCES', 'MATHEMATIQUES', 'SCIENCES_SOCIALES', 'ARTS', 'SPORTS', 'AUTRE')`
    ),
  })
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
  (table) => ({
    schoolIdIdx: index('classroom_school_id_idx').on(table.schoolId),
    academicYearIdIdx: index('classroom_academic_year_id_idx').on(table.academicYearId),
    classLevelIdIdx: index('classroom_class_level_id_idx').on(table.classLevelId),
    // The tenant/year code identifies the cohort (e.g. 3E-A); a soft-deleted
    // classroom frees its code for reuse.
    schoolYearCodeUnique: uniqueIndex('classroom_school_year_code_unique')
      .on(table.schoolId, table.academicYearId, table.code)
      .where(sql`${table.deletedAt} is null`),
    schoolIdIdUnique: uniqueIndex('classroom_school_id_id_unique').on(table.schoolId, table.id),
    capacityCheck: check(
      'classroom_capacity_check',
      sql`${table.capacity} is null OR ${table.capacity} >= 1`
    ),
    academicYearFk: foreignKey({
      columns: [table.schoolId, table.academicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    classLevelFk: foreignKey({
      columns: [table.schoolId, table.classLevelId],
      foreignColumns: [classLevel.schoolId, classLevel.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  })
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
  (table) => ({
    schoolIdIdx: index('class_subject_school_id_idx').on(table.schoolId),
    classroomIdIdx: index('class_subject_classroom_id_idx').on(table.classroomId),
    subjectIdIdx: index('class_subject_subject_id_idx').on(table.subjectId),
    teacherIdIdx: index('class_subject_teacher_id_idx').on(table.teacherId),
    // The classroom/subject pair is tenant-locally unique in the academic context.
    schoolClassroomSubjectUnique: uniqueIndex('class_subject_school_classroom_subject_unique')
      .on(table.schoolId, table.classroomId, table.subjectId)
      .where(sql`${table.deletedAt} is null`),
    schoolIdIdUnique: uniqueIndex('class_subject_school_id_id_unique').on(table.schoolId, table.id),
    coefficientCheck: check('class_subject_coefficient_check', sql`${table.coefficient} >= 1`),
    classroomFk: foreignKey({
      columns: [table.schoolId, table.classroomId],
      foreignColumns: [classroom.schoolId, classroom.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    subjectFk: foreignKey({
      columns: [table.schoolId, table.subjectId],
      foreignColumns: [subject.schoolId, subject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    teacherFk: foreignKey({
      columns: [table.schoolId, table.teacherId],
      foreignColumns: [teacher.schoolId, teacher.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  })
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
  (table) => ({
    schoolIdIdx: index('class_enrollment_school_id_idx').on(table.schoolId),
    studentIdIdx: index('class_enrollment_student_id_idx').on(table.studentId),
    classroomIdIdx: index('class_enrollment_classroom_id_idx').on(table.classroomId),
    academicYearIdIdx: index('class_enrollment_academic_year_id_idx').on(table.academicYearId),
    schoolClassroomStudentUnique: uniqueIndex('class_enrollment_school_classroom_student_unique')
      .on(table.schoolId, table.classroomId, table.studentId)
      .where(sql`${table.deletedAt} is null`),
    // AGENTS.md §9.3: a student has at most one ACTIVE class enrollment per year.
    schoolStudentYearActiveUnique: uniqueIndex('class_enrollment_school_student_year_active_unique')
      .on(table.schoolId, table.studentId, table.academicYearId)
      .where(sql`${table.status} = 'ACTIVE' AND ${table.deletedAt} is null`),
    schoolIdIdUnique: uniqueIndex('class_enrollment_school_id_id_unique').on(
      table.schoolId,
      table.id
    ),
    statusCheck: check(
      'class_enrollment_status_check',
      sql`${table.status} in ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED', 'PROMOTED')`
    ),
    studentFk: foreignKey({
      columns: [table.schoolId, table.studentId],
      foreignColumns: [student.schoolId, student.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    classroomFk: foreignKey({
      columns: [table.schoolId, table.classroomId],
      foreignColumns: [classroom.schoolId, classroom.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    academicYearFk: foreignKey({
      columns: [table.schoolId, table.academicYearId],
      foreignColumns: [academicYear.schoolId, academicYear.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  })
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
  (table) => ({
    schoolIdIdx: index('student_subject_enrollment_school_id_idx').on(table.schoolId),
    classEnrollmentIdIdx: index('student_subject_enrollment_class_enrollment_id_idx').on(
      table.classEnrollmentId
    ),
    classSubjectIdIdx: index('student_subject_enrollment_class_subject_id_idx').on(
      table.classSubjectId
    ),
    schoolEnrollmentSubjectUnique: uniqueIndex(
      'student_subject_enrollment_school_enrollment_subject_unique'
    )
      .on(table.schoolId, table.classEnrollmentId, table.classSubjectId)
      .where(sql`${table.deletedAt} is null`),
    schoolIdIdUnique: uniqueIndex('student_subject_enrollment_school_id_id_unique').on(
      table.schoolId,
      table.id
    ),
    classEnrollmentFk: foreignKey({
      columns: [table.schoolId, table.classEnrollmentId],
      foreignColumns: [classEnrollment.schoolId, classEnrollment.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    classSubjectFk: foreignKey({
      columns: [table.schoolId, table.classSubjectId],
      foreignColumns: [classSubject.schoolId, classSubject.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  })
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
