import {
  createAcademicYearRepository,
  createAuditLogRepository,
  createClassEnrollmentRepository,
  createClassSubjectRepository,
  createClassroomRepository,
  createStudentRepository,
  createStudentSubjectEnrollmentRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import type {
  ClassRegisterExportResponse,
  ClassroomRosterResponse,
  EnrolOptionalSubjectsRequest,
  EnrolStudentsResponse,
  StudentsMissingClassResponse,
  StudentSubjectEnrollmentResponse,
  TransferStudentRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import {
  capacityExceeded,
  classesForbidden,
  classroomNotFound,
  classSubjectNotFound,
  classSubjectRequiredLink,
  enrollmentNotFound,
  studentNotFound,
} from './classes.errors.js';
import {
  toEnrollmentResponse,
  toRosterStudent,
  toStudentSubjectEnrollmentResponse,
} from './classes.mappers.js';
import { ClassroomsService } from './classrooms.service.js';

export interface ClassEnrollmentsServiceOptions {
  now?: () => Date;
}

/**
 * Application service for class enrolment (roadmap §10.3).
 *
 * Invariants enforced here (and mirrored in the database):
 * - A student has at most one ACTIVE enrollment per academic year.
 * - Joining a class auto-enrols the required class-subjects; optional
 *   class-subjects are enrolled explicitly (EnrolOptionalSubjects).
 * - A transfer closes the current ACTIVE enrollment (TRANSFERRED, with the
 *   effective date and reason preserved) and opens a new one - history is
 *   never destroyed (AGENTS.md §9.3).
 * - Class capacity is respected when set.
 */
export class ClassEnrollmentsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: ClassEnrollmentsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Bulk-enrols students into a classroom for the classroom's academic year.
   * Each student is processed independently: already-enrolled or missing
   * students are reported per item, never failing the whole batch.
   */
  enrolStudents(
    actor: AuthenticatedUser,
    input: { classroomId: string; studentIds: string[] },
    requestContext: RequestAuditContext = {}
  ): EnrolStudentsResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const classroom = createClassroomRepository(transaction, tenant).findById(input.classroomId);

      if (!classroom) {
        throw classroomNotFound();
      }

      const enrollmentRepository = createClassEnrollmentRepository(transaction, tenant);
      const studentRepository = createStudentRepository(transaction, tenant);
      const classSubjectRepository = createClassSubjectRepository(transaction, tenant);
      const requiredSubjects = classSubjectRepository
        .list({
          classroomId: classroom.id,
          limit: 200,
        })
        .filter((classSubject) => classSubject.isRequired);
      const skipped: EnrolStudentsResponse['skipped'] = [];
      let imported = 0;

      for (const studentId of input.studentIds) {
        const student = studentRepository.findById(studentId);

        if (!student?.isActive) {
          skipped.push({
            studentId,
            ok: false,
            errorCode: 'STUDENT_NOT_FOUND',
            message: 'Eleve introuvable ou archive.',
          });
          continue;
        }

        const alreadyActive = enrollmentRepository.findActiveByStudentYear(
          studentId,
          classroom.academicYearId
        );

        if (alreadyActive) {
          skipped.push({
            studentId,
            ok: false,
            errorCode: 'ALREADY_ENROLLED',
            message: 'Cet eleve est deja inscrit dans une classe pour cette annee scolaire.',
          });
          continue;
        }

        if (classroom.capacity !== null) {
          const currentCount = enrollmentRepository.count({
            classroomId: classroom.id,
            status: 'ACTIVE',
          });

          if (currentCount >= classroom.capacity) {
            skipped.push({
              studentId,
              ok: false,
              errorCode: 'CAPACITY_EXCEEDED',
              message: 'La capacite maximale de la classe serait depassee.',
            });
            continue;
          }
        }

        const enrollment = enrollmentRepository.create({
          studentId,
          classroomId: classroom.id,
          academicYearId: classroom.academicYearId,
          enrollmentDate: this.now().toISOString().slice(0, 10),
        });

        // Auto-enrol required class-subjects for the new student.
        for (const classSubject of requiredSubjects) {
          const linkRepository = createStudentSubjectEnrollmentRepository(transaction, tenant);

          if (!linkRepository.findByEnrollmentSubject(enrollment.id, classSubject.id)) {
            linkRepository.create({
              classEnrollmentId: enrollment.id,
              classSubjectId: classSubject.id,
            });
          }
        }

        imported += 1;
      }

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'ENROLMENT_BULK',
        targetType: 'classroom',
        targetId: classroom.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { requested: input.studentIds.length, imported, skipped: skipped.length },
      });

      return { classroomId: classroom.id, imported, skipped };
    });
  }

  /**
   * Transfers a student to another classroom with an effective date and a
   * reason. The current ACTIVE enrollment is closed (status TRANSFERRED) and a
   * new ACTIVE enrollment opens on the target classroom - the old row and its
   * history remain consultable.
   */
  transfer(
    actor: AuthenticatedUser,
    studentId: string,
    input: TransferStudentRequest,
    requestContext: RequestAuditContext = {}
  ) {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const target = createClassroomRepository(transaction, tenant).findById(
        input.targetClassroomId
      );

      if (!target) {
        throw classroomNotFound();
      }

      const student = createStudentRepository(transaction, tenant).findById(studentId);

      if (!student?.isActive) {
        throw studentNotFound();
      }

      const enrollmentRepository = createClassEnrollmentRepository(transaction, tenant);
      const current = enrollmentRepository.findActiveByStudentYear(
        studentId,
        target.academicYearId
      );

      if (!current) {
        // No active enrollment to transfer from - this is a fresh enrolment.
        throw enrollmentNotFound();
      }

      if (current.classroomId === target.id) {
        throw enrollmentNotFound();
      }

      if (target.capacity !== null) {
        const currentCount = enrollmentRepository.count({
          classroomId: target.id,
          status: 'ACTIVE',
        });

        if (currentCount >= target.capacity) {
          throw capacityExceeded();
        }
      }

      const closed = enrollmentRepository.updateStatus(current.id, 'TRANSFERRED', updatedAt, {
        exitDate: input.effectiveDate,
        reason: input.reason,
      });
      const opened = enrollmentRepository.create({
        studentId,
        classroomId: target.id,
        academicYearId: target.academicYearId,
        enrollmentDate: input.effectiveDate,
      });

      // Required subjects of the target class are auto-enrolled for the mover.
      const requiredSubjects = createClassSubjectRepository(transaction, tenant)
        .list({ classroomId: target.id, limit: 200 })
        .filter((classSubject) => classSubject.isRequired);

      for (const classSubject of requiredSubjects) {
        const linkRepository = createStudentSubjectEnrollmentRepository(transaction, tenant);

        if (!linkRepository.findByEnrollmentSubject(opened.id, classSubject.id)) {
          linkRepository.create({
            classEnrollmentId: opened.id,
            classSubjectId: classSubject.id,
          });
        }
      }

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'ENROLMENT_TRANSFER',
        targetType: 'student',
        targetId: studentId,
        correlationId: requestContext.correlationId ?? null,
        metadata: {
          fromEnrollmentId: closed.id,
          toClassroomId: target.id,
          effectiveDate: input.effectiveDate,
          reason: input.reason,
        },
      });

      return {
        closed: toEnrollmentResponse(closed),
        opened: toEnrollmentResponse(opened),
      };
    });
  }

  /** Roster of a classroom: active enrollments with student identity + capacity. */
  getRoster(actor: AuthenticatedUser, classroomId: string): ClassroomRosterResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const classroomView = new ClassroomsService(this.db).getRosterContext(actor, classroomId);

    if (!classroomView) {
      throw classroomNotFound();
    }

    const classroom = createClassroomRepository(this.db, tenant).findById(classroomId);

    if (!classroom) {
      throw classroomNotFound();
    }

    const entries = createClassEnrollmentRepository(this.db, tenant)
      .list({ classroomId, status: 'ACTIVE', limit: 500 })
      .map((enrollment) => {
        const student = createStudentRepository(this.db, tenant).findById(enrollment.studentId);

        return student
          ? {
              enrollment: toEnrollmentResponse(enrollment),
              student: toRosterStudent(student),
            }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
      classroom: classroomView,
      capacity: classroom.capacity,
      enrolledCount: entries.length,
      entries,
    };
  }

  /** Active students with no ACTIVE enrollment in the current academic year. */
  listStudentsMissingClass(actor: AuthenticatedUser): StudentsMissingClassResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const academicYear = createAcademicYearRepository(this.db, tenant).findCurrent();

    if (!academicYear) {
      return { academicYearId: '', academicYearLabel: '', students: [], total: 0 };
    }

    const enrollmentRepository = createClassEnrollmentRepository(this.db, tenant);
    const students = createStudentRepository(this.db, tenant)
      .listActive({ limit: 1000 })
      .filter(
        (student) => !enrollmentRepository.findActiveByStudentYear(student.id, academicYear.id)
      )
      .map((student) => ({
        id: student.id,
        code: student.code,
        firstName: student.firstName,
        lastName: student.lastName,
      }));

    return {
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      students,
      total: students.length,
    };
  }

  /**
   * Explicitly enrols a student in optional class-subjects of their class.
   * Required class-subjects are auto-enrolled on enrolment and rejected here.
   */
  enrolOptionalSubjects(
    actor: AuthenticatedUser,
    input: EnrolOptionalSubjectsRequest,
    requestContext: RequestAuditContext = {}
  ): StudentSubjectEnrollmentResponse[] {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const classroom = createClassroomRepository(transaction, tenant).findById(input.classroomId);

      if (!classroom) {
        throw classroomNotFound();
      }

      const enrollment = createClassEnrollmentRepository(
        transaction,
        tenant
      ).findActiveByStudentYear(input.studentId, classroom.academicYearId);

      if (!enrollment) {
        throw enrollmentNotFound();
      }

      const classSubjectRepository = createClassSubjectRepository(transaction, tenant);
      const linkRepository = createStudentSubjectEnrollmentRepository(transaction, tenant);
      const created: StudentSubjectEnrollmentResponse[] = [];

      for (const classSubjectId of input.classSubjectIds) {
        const classSubject = classSubjectRepository.findById(classSubjectId);

        if (classSubject?.classroomId !== classroom.id) {
          throw classSubjectNotFound();
        }

        if (classSubject.isRequired) {
          throw classSubjectRequiredLink();
        }

        if (linkRepository.findByEnrollmentSubject(enrollment.id, classSubjectId)) {
          continue;
        }

        const link = linkRepository.create({
          classEnrollmentId: enrollment.id,
          classSubjectId,
        });
        created.push(toStudentSubjectEnrollmentResponse(link));
      }

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'ENROLMENT_OPTIONAL_SUBJECTS',
        targetType: 'student',
        targetId: input.studentId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { classroomId: classroom.id, classSubjectIds: input.classSubjectIds },
      });

      return created;
    });
  }

  /**
   * Exports the active roster of a classroom as a CSV class register. Cells
   * starting with a formula character are escaped (AGENTS.md §13).
   */
  exportRegister(actor: AuthenticatedUser, classroomId: string): ClassRegisterExportResponse {
    this.assertSchoolMaster(actor);
    const roster = this.getRoster(actor, classroomId);
    const rows: string[][] = [
      ['Code', 'Nom', 'Prénom', 'Sexe', 'Date de naissance'],
      ...roster.entries.map((entry) => [
        entry.student.code,
        entry.student.lastName,
        entry.student.firstName,
        entry.student.sex ?? '',
        entry.student.dateOfBirth ?? '',
      ]),
    ];
    const content = rows
      .map((row) => row.map(escapeCsvCell).join(';'))
      .join('\r\n')
      .concat('\r\n');
    const classroomLabel = `${roster.classroom.classLevelName} ${roster.classroom.classroom.code}`;
    const filename = `registre-${roster.classroom.classroom.code.toLowerCase()}.csv`;

    return { classroomLabel, filename, content };
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}

/** Escapes cells beginning with spreadsheet formula characters (= + - @ \t \r). */
function escapeCsvCell(value: string) {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }

  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
