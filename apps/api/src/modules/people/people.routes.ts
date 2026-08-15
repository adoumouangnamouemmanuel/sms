import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { PeopleController } from './people.controller.js';
import type { GuardiansService } from './guardians.service.js';
import type { StudentsService } from './students.service.js';
import type { TeachersService } from './teachers.service.js';

export interface RegisterPeopleRoutesOptions {
  authService: AuthService;
  guardiansService: GuardiansService;
  studentsService: StudentsService;
  teachersService: TeachersService;
}

/** Registers the Phase 3.2/3.3 people route surface (students, guardians, teachers). */
export function registerPeopleRoutes(
  server: FastifyInstance,
  options: RegisterPeopleRoutesOptions
) {
  const controller = new PeopleController(
    options.authService,
    options.studentsService,
    options.guardiansService,
    options.teachersService
  );

  server.get('/students', controller.listStudents);
  server.get('/students/:studentId', controller.getStudentProfile);
  server.post('/students', controller.createStudent);
  server.put('/students/:studentId', controller.updateStudent);
  server.post('/students/:studentId/archive', controller.archiveStudent);
  server.post('/students/:studentId/reactivate', controller.reactivateStudent);
  server.post('/students/:studentId/guardians', controller.linkGuardian);

  server.put('/student-guardians/:linkId', controller.updateGuardianLink);
  server.delete('/student-guardians/:linkId', controller.unlinkGuardian);

  server.get('/guardians', controller.listGuardians);
  server.get('/guardians/:guardianId', controller.getGuardianProfile);
  server.post('/guardians', controller.createGuardian);
  server.put('/guardians/:guardianId', controller.updateGuardian);
  server.post('/guardians/:guardianId/archive', controller.archiveGuardian);
  server.post('/guardians/:guardianId/reactivate', controller.reactivateGuardian);

  server.get('/teachers', controller.listTeachers);
  server.get('/teachers/:teacherId', controller.getTeacherProfile);
  server.post('/teachers', controller.createTeacher);
  server.put('/teachers/:teacherId', controller.updateTeacher);
  server.post('/teachers/:teacherId/archive', controller.archiveTeacher);
  server.post('/teachers/:teacherId/reactivate', controller.reactivateTeacher);
  server.post('/teachers/:teacherId/login', controller.createTeacherLogin);
  server.post('/teachers/:teacherId/login/deactivate', controller.deactivateTeacherLogin);
  server.post('/teachers/:teacherId/login/reactivate', controller.reactivateTeacherLogin);
}
