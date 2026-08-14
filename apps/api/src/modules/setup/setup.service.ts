import {
  createAcademicYearRepository,
  createAuditLogRepository,
  createClassLevelRepository,
  createSchoolModuleConfigRepository,
  createTenantContext,
  createTenantSchoolRepository,
  createTermRepository,
  withTransaction,
  type EduTrackDatabase,
  type SafeSchoolRecord,
  type TermRecord,
} from '@edutrack/db';
import {
  type SchoolSetupStatus,
  type SetupCalendarRequest,
  type SetupClassLevelInput,
  type SetupClassLevelsRequest,
  type SetupSchoolProfileRequest,
  type SetupStateResponse,
  type SetupStepId,
  type TermSystem,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import {
  classLevelsRequired,
  invalidAcademicYear,
  invalidClassLevels,
  invalidSetupStep,
  invalidTerms,
  schoolNotFound,
  setupForbidden,
} from './setup.errors.js';

const statusRank: Record<SchoolSetupStatus, number> = {
  PENDING: 0,
  PROFILE_COMPLETED: 1,
  CALENDAR_COMPLETED: 2,
  CLASS_LEVELS_COMPLETED: 3,
  COMPLETED: 4,
};

export interface SetupServiceOptions {
  now?: () => Date;
}

/** Application service for the offline-first school setup wizard. */
export class SetupService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: SetupServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  getState(actor: AuthenticatedUser): SetupStateResponse {
    this.assertSchoolMaster(actor);

    return this.readState(actor.schoolId);
  }

  saveProfile(
    actor: AuthenticatedUser,
    input: SetupSchoolProfileRequest,
    requestContext: RequestAuditContext = {}
  ): SetupStateResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const schoolRepository = createTenantSchoolRepository(transaction, tenant);
      const school = requireSchool(
        schoolRepository.updateProfile(normalizeProfile(input), updatedAt)
      );
      const nextStatus = advanceStatus(school.setupStatus, 'PROFILE_COMPLETED');

      schoolRepository.updateSetupStatus(nextStatus, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SETUP_PROFILE_SAVE',
        targetType: 'school',
        targetId: actor.schoolId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { setupStatus: nextStatus },
      });

      return this.readState(actor.schoolId, transaction);
    });
  }

  saveCalendar(
    actor: AuthenticatedUser,
    input: SetupCalendarRequest,
    requestContext: RequestAuditContext = {}
  ): SetupStateResponse {
    this.assertSchoolMaster(actor);
    const normalizedInput = normalizeCalendar(input);
    validateCalendar(normalizedInput);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const schoolRepository = createTenantSchoolRepository(transaction, tenant);
      const school = requireSchool(schoolRepository.findActive());

      assertStatusAtLeast(school.setupStatus, 'PROFILE_COMPLETED');

      const academicYearRepository = createAcademicYearRepository(transaction, tenant);
      academicYearRepository.clearCurrent(updatedAt);

      const existingYear = academicYearRepository.findActiveByLabel(
        normalizedInput.academicYear.label
      );
      const academicYear =
        existingYear === undefined
          ? academicYearRepository.createCurrent(normalizedInput.academicYear, updatedAt)
          : academicYearRepository.updateCurrent(
              existingYear.id,
              normalizedInput.academicYear,
              updatedAt
            );

      createTermRepository(transaction, tenant).replaceForAcademicYear(
        academicYear.id,
        normalizedInput.terms,
        updatedAt
      );
      schoolRepository.updateSetupStatus(
        advanceStatus(school.setupStatus, 'CALENDAR_COMPLETED'),
        updatedAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SETUP_CALENDAR_SAVE',
        targetType: 'academic_year',
        targetId: academicYear.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: {
          termSystem: normalizedInput.termSystem,
          terms: normalizedInput.terms.length,
        },
      });

      return this.readState(actor.schoolId, transaction);
    });
  }

  saveClassLevels(
    actor: AuthenticatedUser,
    input: SetupClassLevelsRequest,
    requestContext: RequestAuditContext = {}
  ): SetupStateResponse {
    this.assertSchoolMaster(actor);
    const classLevels = normalizeClassLevels(input.classLevels);
    validateClassLevels(classLevels);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const schoolRepository = createTenantSchoolRepository(transaction, tenant);
      const school = requireSchool(schoolRepository.findActive());

      assertStatusAtLeast(school.setupStatus, 'CALENDAR_COMPLETED');

      createClassLevelRepository(transaction, tenant).replaceActive(classLevels, updatedAt);
      schoolRepository.updateSetupStatus(
        advanceStatus(school.setupStatus, 'CLASS_LEVELS_COMPLETED'),
        updatedAt
      );
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SETUP_CLASS_LEVELS_SAVE',
        targetType: 'class_level',
        correlationId: requestContext.correlationId ?? null,
        metadata: { classLevels: classLevels.length },
      });

      return this.readState(actor.schoolId, transaction);
    });
  }

  completeSetup(
    actor: AuthenticatedUser,
    requestContext: RequestAuditContext = {}
  ): SetupStateResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const schoolRepository = createTenantSchoolRepository(transaction, tenant);
      const school = requireSchool(schoolRepository.findActive());
      const academicYear = createAcademicYearRepository(transaction, tenant).findCurrent();
      const terms = academicYear
        ? createTermRepository(transaction, tenant).listForAcademicYear(academicYear.id)
        : [];
      const classLevels = createClassLevelRepository(transaction, tenant).listActive();

      assertStatusAtLeast(school.setupStatus, 'CLASS_LEVELS_COMPLETED');

      if (!academicYear || terms.length === 0 || classLevels.length === 0) {
        throw classLevelsRequired();
      }

      createSchoolModuleConfigRepository(transaction, tenant).ensureImplementedModulesEnabled(
        updatedAt
      );
      schoolRepository.updateSetupStatus('COMPLETED', updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'SETUP_COMPLETE',
        targetType: 'school',
        targetId: actor.schoolId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { enabledModules: ['SCHOOL_SETUP', 'ACADEMIC_STRUCTURE'] },
      });

      return this.readState(actor.schoolId, transaction);
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw setupForbidden();
    }
  }

  private readState(schoolId: string, executor = this.db): SetupStateResponse {
    const tenant = createTenantContext(schoolId);
    const school = requireSchool(createTenantSchoolRepository(executor, tenant).findActive());
    const academicYear = createAcademicYearRepository(executor, tenant).findCurrent() ?? null;
    const terms = academicYear
      ? createTermRepository(executor, tenant).listForAcademicYear(academicYear.id)
      : [];

    return {
      school,
      academicYear,
      termSystem: inferTermSystem(terms),
      terms,
      classLevels: createClassLevelRepository(executor, tenant).listActive(),
      enabledModules: createSchoolModuleConfigRepository(executor, tenant).listEnabled(),
      nextStep: resolveNextStep(school.setupStatus),
    };
  }
}

function normalizeProfile(input: SetupSchoolProfileRequest) {
  return {
    name: input.name.trim(),
    shortName: normalizeNullableText(input.shortName),
    logoUrl: normalizeNullableText(input.logoUrl),
    address: normalizeNullableText(input.address),
    city: input.city.trim(),
    phone: normalizeNullableText(input.phone),
    email: normalizeNullableText(input.email),
    motto: normalizeNullableText(input.motto),
    ministryCode: normalizeNullableText(input.ministryCode),
  };
}

function normalizeCalendar(input: SetupCalendarRequest): SetupCalendarRequest {
  return {
    academicYear: {
      label: input.academicYear.label.trim(),
      startDate: input.academicYear.startDate,
      endDate: input.academicYear.endDate,
    },
    termSystem: input.termSystem,
    terms: input.terms.map((term) => ({
      ...term,
      label: term.label.trim(),
    })),
  };
}

function normalizeClassLevels(input: SetupClassLevelInput[]) {
  return input
    .map((classLevel) => ({
      code: classLevel.code.trim().toUpperCase(),
      name: classLevel.name.trim(),
      displayOrder: classLevel.displayOrder,
      isExamYear: classLevel.isExamYear,
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function validateCalendar(input: SetupCalendarRequest) {
  const expectedTermCount = input.termSystem === 'TRIMESTER' ? 3 : 2;

  if (input.academicYear.startDate >= input.academicYear.endDate) {
    throw invalidAcademicYear("La date de debut doit preceder la date de fin de l'annee.");
  }

  if (input.terms.length !== expectedTermCount) {
    throw invalidTerms(
      input.termSystem === 'TRIMESTER'
        ? 'Le systeme trimestriel doit contenir trois trimestres.'
        : 'Le systeme semestriel doit contenir deux semestres.'
    );
  }

  const currentTerms = input.terms.filter((term) => term.isCurrent);

  if (currentTerms.length !== 1) {
    throw invalidTerms('Une seule periode courante doit etre selectionnee.');
  }

  const termNumbers = new Set<number>();
  const termLabels = new Set<string>();
  const sortedTerms = [...input.terms].sort((left, right) =>
    left.startDate.localeCompare(right.startDate)
  );

  for (const term of sortedTerms) {
    if (term.termNumber > expectedTermCount) {
      throw invalidTerms('Les numeros de periode doivent correspondre au systeme choisi.');
    }

    if (termNumbers.has(term.termNumber) || termLabels.has(term.label.toLocaleLowerCase())) {
      throw invalidTerms('Les periodes doivent avoir des numeros et libelles uniques.');
    }

    if (term.startDate > term.endDate) {
      throw invalidTerms('La date de debut de chaque periode doit preceder sa date de fin.');
    }

    if (
      term.startDate < input.academicYear.startDate ||
      term.endDate > input.academicYear.endDate
    ) {
      throw invalidTerms("Les periodes doivent rester dans l'annee scolaire.");
    }

    termNumbers.add(term.termNumber);
    termLabels.add(term.label.toLocaleLowerCase());
  }

  for (let index = 1; index < sortedTerms.length; index += 1) {
    const previousTerm = sortedTerms[index - 1];
    const currentTerm = sortedTerms[index];

    if (previousTerm && currentTerm && previousTerm.endDate >= currentTerm.startDate) {
      throw invalidTerms('Les periodes scolaires ne doivent pas se chevaucher.');
    }
  }
}

function validateClassLevels(classLevels: SetupClassLevelInput[]) {
  const codes = new Set<string>();
  const names = new Set<string>();
  const orders = new Set<number>();

  for (const classLevel of classLevels) {
    const normalizedName = classLevel.name.toLocaleLowerCase();

    if (
      codes.has(classLevel.code) ||
      names.has(normalizedName) ||
      orders.has(classLevel.displayOrder)
    ) {
      throw invalidClassLevels(
        'Les codes, noms et ordres des niveaux de classe doivent etre uniques.'
      );
    }

    codes.add(classLevel.code);
    names.add(normalizedName);
    orders.add(classLevel.displayOrder);
  }
}

function inferTermSystem(terms: TermRecord[]): TermSystem | null {
  if (terms.length === 2) {
    return 'SEMESTER';
  }

  if (terms.length === 3) {
    return 'TRIMESTER';
  }

  return null;
}

function resolveNextStep(status: SchoolSetupStatus): SetupStepId {
  switch (status) {
    case 'PENDING':
      return 'profile';
    case 'PROFILE_COMPLETED':
      return 'calendar';
    case 'CALENDAR_COMPLETED':
      return 'classLevels';
    case 'CLASS_LEVELS_COMPLETED':
    case 'COMPLETED':
      return 'review';
  }
}

function advanceStatus(currentStatus: SchoolSetupStatus, targetStatus: SchoolSetupStatus) {
  return statusRank[currentStatus] >= statusRank[targetStatus] ? currentStatus : targetStatus;
}

function assertStatusAtLeast(currentStatus: SchoolSetupStatus, minimumStatus: SchoolSetupStatus) {
  if (statusRank[currentStatus] < statusRank[minimumStatus]) {
    throw invalidSetupStep();
  }
}

function requireSchool(school: SafeSchoolRecord | undefined) {
  if (!school) {
    throw schoolNotFound();
  }

  return school;
}
