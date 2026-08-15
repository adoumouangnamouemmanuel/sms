import {
  createAuditLogRepository,
  createClassSubjectRepository,
  createClassroomRepository,
  createSubjectRepository,
  createTeacherRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import type {
  CurriculumCopyConfirmResponse,
  CurriculumCopyPreviewRequest,
  CurriculumCopyPreviewResponse,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { classesForbidden, classroomNotFound } from './classes.errors.js';

/**
 * Copies the subject/coefficient/teacher assignment of a source classroom
 * onto a target classroom (roadmap §10.2 - "copy a curriculum from a previous
 * class/year with review before confirmation"). The preview lists exactly what
 * would be assigned; confirmation only adds pairs the target does not already
 * have (idempotent).
 */
export class CurriculumService {
  constructor(private readonly db: EduTrackDatabase) {}

  copyPreview(
    actor: AuthenticatedUser,
    input: CurriculumCopyPreviewRequest
  ): CurriculumCopyPreviewResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    const source = createClassroomRepository(this.db, tenant).findById(input.sourceClassroomId);

    if (!source) {
      throw classroomNotFound();
    }

    const target = createClassroomRepository(this.db, tenant).findById(input.targetClassroomId);

    if (!target) {
      throw classroomNotFound();
    }

    const classSubjectRepository = createClassSubjectRepository(this.db, tenant);
    const subjectRepository = createSubjectRepository(this.db, tenant);
    const teacherRepository = createTeacherRepository(this.db, tenant);
    const sourceClassSubjects = classSubjectRepository.list({
      classroomId: source.id,
      limit: 200,
    });
    const targetPairs = new Set(
      classSubjectRepository
        .list({ classroomId: target.id, limit: 200 })
        .map((classSubject) => classSubject.subjectId)
    );
    const items = sourceClassSubjects.map((classSubject) => {
      const subject = subjectRepository.findById(classSubject.subjectId);
      const teacher = classSubject.teacherId
        ? teacherRepository.findById(classSubject.teacherId)
        : null;

      return {
        subjectId: classSubject.subjectId,
        subjectCode: subject?.code ?? '',
        subjectName: subject?.name ?? 'Matière inconnue',
        coefficient: classSubject.coefficient,
        isRequired: classSubject.isRequired,
        teacherId: classSubject.teacherId,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
        alreadyAssigned: targetPairs.has(classSubject.subjectId),
      };
    });

    return {
      sourceClassroomId: source.id,
      sourceClassroomLabel: buildClassroomLabel(source.code, source.name),
      targetClassroomId: target.id,
      targetClassroomLabel: buildClassroomLabel(target.code, target.name),
      items,
      newCount: items.filter((item) => !item.alreadyAssigned).length,
      skippedCount: items.filter((item) => item.alreadyAssigned).length,
    };
  }

  copyConfirm(
    actor: AuthenticatedUser,
    input: CurriculumCopyPreviewRequest,
    requestContext: RequestAuditContext = {}
  ): CurriculumCopyConfirmResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    return withTransaction(this.db, (transaction) => {
      const source = createClassroomRepository(transaction, tenant).findById(
        input.sourceClassroomId
      );

      if (!source) {
        throw classroomNotFound();
      }

      const target = createClassroomRepository(transaction, tenant).findById(
        input.targetClassroomId
      );

      if (!target) {
        throw classroomNotFound();
      }

      const classSubjectRepository = createClassSubjectRepository(transaction, tenant);
      const sourceClassSubjects = classSubjectRepository.list({
        classroomId: source.id,
        limit: 200,
      });
      const existingPairs = new Set(
        classSubjectRepository
          .list({ classroomId: target.id, limit: 200 })
          .map((classSubject) => classSubject.subjectId)
      );
      let assigned = 0;
      let skipped = 0;

      for (const classSubject of sourceClassSubjects) {
        if (existingPairs.has(classSubject.subjectId)) {
          skipped += 1;
          continue;
        }

        try {
          classSubjectRepository.create({
            classroomId: target.id,
            subjectId: classSubject.subjectId,
            coefficient: classSubject.coefficient,
            isRequired: classSubject.isRequired,
            teacherId: classSubject.teacherId,
          });
          assigned += 1;
        } catch (error) {
          // A concurrent assignment won the race for this pair.
          if (isUniqueConstraintViolation(error)) {
            skipped += 1;
          } else {
            throw error;
          }
        }
      }

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CURRICULUM_COPY',
        targetType: 'classroom',
        targetId: target.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { sourceClassroomId: source.id, assigned, skipped },
      });

      return { targetClassroomId: target.id, assigned, skipped };
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}

function buildClassroomLabel(code: string, name: string | null) {
  return name ? `${code} - ${name}` : code;
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
