import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/index.js';
import { PeopleController } from './people.controller.js';
import type { GuardiansService } from './guardians.service.js';
import type { StudentsService } from './students.service.js';

export interface RegisterPeopleRoutesOptions {
  authService: AuthService;
  guardiansService: GuardiansService;
  studentsService: StudentsService;
}

/** Registers the Phase 3.2 student and guardian route surface. */
export function registerPeopleRoutes(
  server: FastifyInstance,
  options: RegisterPeopleRoutesOptions
) {
  const controller = new PeopleController(
    options.authService,
    options.studentsService,
    options.guardiansService
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
}
