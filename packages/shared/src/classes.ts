import { z } from 'zod';

/**
 * Phase 4 — classes and curriculum domain (roadmap §10).
 * Transport types shared by the API and the web UI.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Subject catalogue categories; French display labels live in the UI i18n. */
export const SUBJECT_CATEGORIES = [
  'LANGUES',
  'SCIENCES',
  'MATHEMATIQUES',
  'SCIENCES_SOCIALES',
  'ARTS',
  'SPORTS',
  'AUTRE',
] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

/**
 * Controlled class-enrollment statuses (AGENTS.md §9.3): state transitions are
 * validated at the service layer — never free-form string updates.
 */
export const ENROLLMENT_STATUSES = [
  'ACTIVE',
  'TRANSFERRED',
  'WITHDRAWN',
  'GRADUATED',
  'PROMOTED',
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/**
 * Official maximum grade policy (AGENTS.md §9.1 and roadmap §10.1): 20.00,
 * stored as integer hundredths and enforced at validation boundaries.
 */
export const MAX_GRADE_HUNDREDTHS = 2000;

/** Maximum coefficient a subject may carry for a class (AGENTS.md §9.1). */
export const MAX_SUBJECT_COEFFICIENT = 20;

/** Record status filters, shared with the people modules. */
export const CLASS_RECORD_STATUS_VALUES = ['active', 'archived'] as const;
export type ClassRecordStatus = (typeof CLASS_RECORD_STATUS_VALUES)[number];

function emptyStringToNull(value: unknown) {
  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  return value;
}

const classNullableTextSchema = z.preprocess(
  emptyStringToNull,
  z.string().trim().max(255).nullable().optional()
);

// ---------------------------------------------------------------------------
// Subject catalogue
// ---------------------------------------------------------------------------

export const createSubjectRequestSchema = z.object({
  // Stable tenant-local code (e.g. "MATH"). Codes are identity for imports.
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  nameEn: classNullableTextSchema,
  nameAr: classNullableTextSchema,
  shortLabel: classNullableTextSchema,
  category: z.enum(SUBJECT_CATEGORIES),
});

export const updateSubjectRequestSchema = createSubjectRequestSchema
  .omit({ code: true })
  .partial()
  .extend({ recordVersion: z.number().int().positive().optional() });

export const subjectResponseSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().nullable(),
  nameAr: z.string().nullable(),
  shortLabel: z.string().nullable(),
  category: z.enum(SUBJECT_CATEGORIES),
  isActive: z.boolean(),
  recordVersion: z.number().int().min(0),
});

export const subjectListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.enum(SUBJECT_CATEGORIES).optional(),
  status: z.enum(CLASS_RECORD_STATUS_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const paginatedSubjectsResponseSchema = z.object({
  items: z.array(subjectResponseSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Classroom
// ---------------------------------------------------------------------------

export const createClassroomRequestSchema = z.object({
  academicYearId: z.uuid(),
  classLevelId: z.uuid(),
  // Cohort code within the year (e.g. "3E-A"); unique per school + year.
  code: z.string().trim().min(1).max(30),
  name: classNullableTextSchema,
  capacity: z.preprocess(
    emptyStringToNull,
    z.number().int().min(1).max(1000).nullable().optional()
  ),
});

export const updateClassroomRequestSchema = z.object({
  name: classNullableTextSchema,
  capacity: z.preprocess(
    emptyStringToNull,
    z.number().int().min(1).max(1000).nullable().optional()
  ),
  recordVersion: z.number().int().positive().optional(),
});

export const classroomResponseSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  classLevelId: z.uuid(),
  code: z.string().min(1),
  name: z.string().nullable(),
  capacity: z.number().int().nullable(),
  isActive: z.boolean(),
  recordVersion: z.number().int().min(0),
});

/** Classroom plus the display context and live headcount for the UI. */
export const classroomViewSchema = z.object({
  classroom: classroomResponseSchema,
  classLevelCode: z.string().min(1),
  classLevelName: z.string().min(1),
  isExamYear: z.boolean(),
  academicYearLabel: z.string().min(1),
  activeEnrollmentCount: z.number().int().min(0),
});

export const classroomListQuerySchema = z.object({
  academicYearId: z.uuid().optional(),
  classLevelId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(CLASS_RECORD_STATUS_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const paginatedClassroomsResponseSchema = z.object({
  items: z.array(classroomViewSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

export const archiveClassroomRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// ---------------------------------------------------------------------------
// Class-subject assignment
// ---------------------------------------------------------------------------

export const assignClassSubjectRequestSchema = z.object({
  classroomId: z.uuid(),
  subjectId: z.uuid(),
  coefficient: z.number().int().min(1).max(MAX_SUBJECT_COEFFICIENT),
  isRequired: z.boolean(),
  teacherId: z.uuid().nullable().optional(),
});

export const updateClassSubjectRequestSchema = z.object({
  coefficient: z.number().int().min(1).max(MAX_SUBJECT_COEFFICIENT).optional(),
  isRequired: z.boolean().optional(),
  teacherId: z.uuid().nullable().optional(),
  recordVersion: z.number().int().positive().optional(),
});

export const classSubjectResponseSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  classroomId: z.uuid(),
  subjectId: z.uuid(),
  coefficient: z.number().int().min(1),
  isRequired: z.boolean(),
  teacherId: z.uuid().nullable(),
  isActive: z.boolean(),
  recordVersion: z.number().int().min(0),
});

/** Class-subject with the subject and teacher display context for the UI. */
export const classSubjectViewSchema = z.object({
  classSubject: classSubjectResponseSchema,
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  subjectCategory: z.enum(SUBJECT_CATEGORIES),
  teacherName: z.string().nullable(),
});

export const classSubjectListQuerySchema = z.object({
  classroomId: z.uuid(),
  status: z.enum(CLASS_RECORD_STATUS_VALUES).optional(),
});

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

export const enrolStudentsRequestSchema = z.object({
  classroomId: z.uuid(),
  // Bulk enrolment: bounded, per-item results reported in the response.
  studentIds: z.array(z.uuid()).min(1).max(100),
});

export const enrolStudentsResultItemSchema = z.object({
  studentId: z.uuid(),
  ok: z.boolean(),
  /** Machine-stable rejection reason for already-enrolled / archived students. */
  errorCode: z.enum(['ALREADY_ENROLLED', 'STUDENT_NOT_FOUND', 'CAPACITY_EXCEEDED']).nullable(),
  message: z.string().nullable(),
});

export const enrolStudentsResponseSchema = z.object({
  classroomId: z.uuid(),
  imported: z.number().int().min(0),
  skipped: z.array(enrolStudentsResultItemSchema),
});

export const transferStudentRequestSchema = z.object({
  targetClassroomId: z.uuid(),
  effectiveDate: z.iso.date(),
  reason: z.string().trim().min(3).max(500),
});

export const enrollmentResponseSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  studentId: z.uuid(),
  classroomId: z.uuid(),
  academicYearId: z.uuid(),
  status: z.enum(ENROLLMENT_STATUSES),
  enrollmentDate: z.string(),
  exitDate: z.string().nullable(),
  reason: z.string().nullable(),
  recordVersion: z.number().int().min(0),
});

/** One line of a class roster: the enrollment plus the student identity. */
export const rosterEntrySchema = z.object({
  enrollment: enrollmentResponseSchema,
  student: z.object({
    id: z.uuid(),
    code: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    sex: z.string().nullable(),
    dateOfBirth: z.string().nullable(),
  }),
});

export const classroomRosterResponseSchema = z.object({
  classroom: classroomViewSchema,
  capacity: z.number().int().nullable(),
  enrolledCount: z.number().int().min(0),
  entries: z.array(rosterEntrySchema),
});

/** Students missing an active class for the year (roadmap §10.3). */
export const studentsMissingClassResponseSchema = z.object({
  academicYearId: z.uuid(),
  academicYearLabel: z.string().min(1),
  students: z.array(
    z.object({
      id: z.uuid(),
      code: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    })
  ),
  total: z.number().int().min(0),
});

export const enrolOptionalSubjectsRequestSchema = z.object({
  classroomId: z.uuid(),
  studentId: z.uuid(),
  // Optional class-subjects to enrol explicitly. Required class-subjects are
  // auto-enrolled when the student joins the class and are not listed here.
  classSubjectIds: z.array(z.uuid()).min(1).max(30),
});

export const studentSubjectEnrollmentResponseSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  classEnrollmentId: z.uuid(),
  classSubjectId: z.uuid(),
  isActive: z.boolean(),
  recordVersion: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Curriculum copy (previous class/year → target, with review)
// ---------------------------------------------------------------------------

export const curriculumCopyPreviewRequestSchema = z.object({
  sourceClassroomId: z.uuid(),
  targetClassroomId: z.uuid(),
});

export const curriculumCopyPreviewItemSchema = z.object({
  subjectId: z.uuid(),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  coefficient: z.number().int().min(1),
  isRequired: z.boolean(),
  teacherId: z.uuid().nullable(),
  teacherName: z.string().nullable(),
  /** Already assigned on the target — will be skipped on confirm. */
  alreadyAssigned: z.boolean(),
});

export const curriculumCopyPreviewResponseSchema = z.object({
  sourceClassroomId: z.uuid(),
  sourceClassroomLabel: z.string().min(1),
  targetClassroomId: z.uuid(),
  targetClassroomLabel: z.string().min(1),
  items: z.array(curriculumCopyPreviewItemSchema),
  newCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
});

export const curriculumCopyConfirmRequestSchema = z.object({
  sourceClassroomId: z.uuid(),
  targetClassroomId: z.uuid(),
});

export const curriculumCopyConfirmResponseSchema = z.object({
  targetClassroomId: z.uuid(),
  assigned: z.number().int().min(0),
  skipped: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Class register export (roadmap §10.3)
// ---------------------------------------------------------------------------

export const classRegisterExportResponseSchema = z.object({
  classroomLabel: z.string().min(1),
  filename: z.string().min(1),
  /** CSV content with formula-injection protection. */
  content: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateSubjectRequest = z.infer<typeof createSubjectRequestSchema>;
export type UpdateSubjectRequest = z.infer<typeof updateSubjectRequestSchema>;
export type SubjectResponse = z.infer<typeof subjectResponseSchema>;
export type SubjectListQuery = z.infer<typeof subjectListQuerySchema>;
export type PaginatedSubjectsResponse = z.infer<typeof paginatedSubjectsResponseSchema>;

export type CreateClassroomRequest = z.infer<typeof createClassroomRequestSchema>;
export type UpdateClassroomRequest = z.infer<typeof updateClassroomRequestSchema>;
export type ClassroomResponse = z.infer<typeof classroomResponseSchema>;
export type ClassroomView = z.infer<typeof classroomViewSchema>;
export type ClassroomListQuery = z.infer<typeof classroomListQuerySchema>;
export type PaginatedClassroomsResponse = z.infer<typeof paginatedClassroomsResponseSchema>;
export type ArchiveClassroomRequest = z.infer<typeof archiveClassroomRequestSchema>;

export type AssignClassSubjectRequest = z.infer<typeof assignClassSubjectRequestSchema>;
export type UpdateClassSubjectRequest = z.infer<typeof updateClassSubjectRequestSchema>;
export type ClassSubjectResponse = z.infer<typeof classSubjectResponseSchema>;
export type ClassSubjectView = z.infer<typeof classSubjectViewSchema>;
export type ClassSubjectListQuery = z.infer<typeof classSubjectListQuerySchema>;

export type EnrolStudentsRequest = z.infer<typeof enrolStudentsRequestSchema>;
export type EnrolStudentsResponse = z.infer<typeof enrolStudentsResponseSchema>;
export type TransferStudentRequest = z.infer<typeof transferStudentRequestSchema>;
export type EnrollmentResponse = z.infer<typeof enrollmentResponseSchema>;
export type ClassroomRosterResponse = z.infer<typeof classroomRosterResponseSchema>;
export type StudentsMissingClassResponse = z.infer<typeof studentsMissingClassResponseSchema>;
export type EnrolOptionalSubjectsRequest = z.infer<typeof enrolOptionalSubjectsRequestSchema>;
export type StudentSubjectEnrollmentResponse = z.infer<
  typeof studentSubjectEnrollmentResponseSchema
>;

export type CurriculumCopyPreviewRequest = z.infer<typeof curriculumCopyPreviewRequestSchema>;
export type CurriculumCopyPreviewResponse = z.infer<typeof curriculumCopyPreviewResponseSchema>;
export type CurriculumCopyConfirmRequest = z.infer<typeof curriculumCopyConfirmRequestSchema>;
export type CurriculumCopyConfirmResponse = z.infer<typeof curriculumCopyConfirmResponseSchema>;

export type ClassRegisterExportResponse = z.infer<typeof classRegisterExportResponseSchema>;
