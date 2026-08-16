import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { ClassesController } from './classes.controller.js';
import type { ClassEnrollmentsService } from './class-enrollments.service.js';
import type { ClassSubjectsService } from './class-subjects.service.js';
import type { ClassroomsService } from './classrooms.service.js';
import type { CurriculumService } from './curriculum.service.js';
import type { SubjectsService } from './subjects.service.js';

export interface RegisterClassesRoutesOptions {
  authService: AuthService;
  subjectsService: SubjectsService;
  classroomsService: ClassroomsService;
  classSubjectsService: ClassSubjectsService;
  classEnrollmentsService: ClassEnrollmentsService;
  curriculumService: CurriculumService;
}

/** Registers the Phase 4.2/4.3 classes, curriculum and enrolment routes. */
export function registerClassesRoutes(
  server: FastifyInstance,
  options: RegisterClassesRoutesOptions
) {
  const controller = new ClassesController(
    options.authService,
    options.subjectsService,
    options.classroomsService,
    options.classSubjectsService,
    options.classEnrollmentsService,
    options.curriculumService
  );

  // Subjects
  server.get('/subjects', controller.listSubjects);
  server.post('/subjects', controller.createSubject);
  server.put('/subjects/:subjectId', controller.updateSubject);
  server.post('/subjects/:subjectId/archive', controller.archiveSubject);
  server.post('/subjects/:subjectId/reactivate', controller.reactivateSubject);

  // Classrooms
  server.get('/classrooms', controller.listClassrooms);
  server.post('/classrooms', controller.createClassroom);
  server.put('/classrooms/:classroomId', controller.updateClassroom);
  server.post('/classrooms/:classroomId/archive', controller.archiveClassroom);
  server.post('/classrooms/:classroomId/reactivate', controller.reactivateClassroom);
  server.get('/classrooms/:classroomId/roster', controller.getClassroomRoster);
  server.get('/classrooms/:classroomId/register', controller.exportClassRegister);

  // Class-subjects (curriculum)
  server.get('/class-subjects', controller.listClassSubjects);
  server.post('/class-subjects', controller.assignClassSubject);
  server.put('/class-subjects/:classSubjectId', controller.updateClassSubject);
  server.delete('/class-subjects/:classSubjectId', controller.removeClassSubject);

  // Enrolment
  server.post('/class-enrollments', controller.enrolStudents);
  server.post('/students/:studentId/transfer', controller.transferStudent);
  server.get('/students/missing-class', controller.listStudentsMissingClass);
  server.post('/class-enrollments/optional-subjects', controller.enrolOptionalSubjects);

  // Curriculum copy
  server.post('/curriculum/copy/preview', controller.previewCurriculumCopy);
  server.post('/curriculum/copy/confirm', controller.confirmCurriculumCopy);
}
