import {
  createAcademicYearRepository,
  createAuditLogRepository,
  createTenantContext,
  createTermRepository,
  withTransaction,
  type AcademicYearRecord,
  type EduTrackDatabase,
  type TermRecord,
} from '@edutrack/db';
import { assertAcademicYearStatusTransition } from '@edutrack/domain';
import type {
  AcademicYearStatusRequest,
  AcademicYearWithTerms,
  AcademicYearsResponse,
  CreateAcademicYearRequest,
} from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { academicYearNotFound, academicYearsForbidden } from './configuration.errors.js';

export interface AcademicYearsServiceOptions {
  now?: () => Date;
}

/**
 * Academic-year lifecycle service (roadmap §9.3, design §4.1).
 *
 * - Creating a year always produces a DRAFT with its terms (never current).
 * - Activating a year rolls the school over: the previous ACTIVE year (if
 *   any) is closed, the new year becomes ACTIVE + current, and its first
 *   term becomes the school's current term.
 * - Closing is explicit and audited; a closed year stays readable.
 * Exactly one ACTIVE year is guaranteed by the domain transition rules, the
 * transactional rollover and the partial unique index (migration 0018).
 */
export class AcademicYearsService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: AcademicYearsServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser): AcademicYearsResponse {
    const tenant = createTenantContext(actor.schoolId);
    const yearRepository = createAcademicYearRepository(this.db, tenant);
    const termRepository = createTermRepository(this.db, tenant);

    return {
      years: yearRepository
        .listWithStatus()
        .map((year) => toAcademicYearView(year, termRepository.listForAcademicYear(year.id))),
    };
  }

  createDraft(
    actor: AuthenticatedUser,
    input: CreateAcademicYearRequest,
    requestContext: RequestAuditContext = {}
  ): AcademicYearWithTerms {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const yearRepository = createAcademicYearRepository(transaction, tenant);
      const termRepository = createTermRepository(transaction, tenant);

      const created = yearRepository.createDraft(
        { label: input.label, startDate: input.startDate, endDate: input.endDate },
        updatedAt
      );
      const terms = termRepository.replaceForAcademicYear(
        created.id,
        input.terms.map((termInput) => ({ ...termInput, isCurrent: false })),
        updatedAt
      );

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_YEAR_CREATE',
        targetType: 'academic_year',
        targetId: created.id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { label: created.label, status: created.status },
      });

      return toAcademicYearView(created, terms);
    });
  }

  changeStatus(
    actor: AuthenticatedUser,
    yearId: string,
    input: AcademicYearStatusRequest,
    requestContext: RequestAuditContext = {}
  ): AcademicYearWithTerms {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const yearRepository = createAcademicYearRepository(transaction, tenant);
      const termRepository = createTermRepository(transaction, tenant);
      const current = yearRepository.findActiveById(yearId);

      if (!current) {
        throw academicYearNotFound();
      }

      assertAcademicYearStatusTransition(current.status, input.status);

      if (input.status === 'ACTIVE') {
        // Rollover: close the previous ACTIVE year before activating the new one.
        const activeYear = yearRepository.findActive();
        if (activeYear && activeYear.id !== yearId) {
          yearRepository.close(activeYear.id, updatedAt);
          createAuditLogRepository(transaction, tenant).createEvent({
            actorUserId: actor.id,
            action: 'CONFIG_YEAR_CLOSE',
            targetType: 'academic_year',
            targetId: activeYear.id,
            correlationId: requestContext.correlationId ?? null,
            metadata: { reason: 'Rollover vers la nouvelle année', label: activeYear.label },
          });
        }

        termRepository.clearCurrentTerms(updatedAt);
        const activated = yearRepository.activate(yearId, updatedAt);
        termRepository.markFirstTermCurrent(yearId, updatedAt);
        const terms = termRepository.listForAcademicYear(yearId);

        createAuditLogRepository(transaction, tenant).createEvent({
          actorUserId: actor.id,
          action: 'CONFIG_YEAR_ACTIVATE',
          targetType: 'academic_year',
          targetId: yearId,
          correlationId: requestContext.correlationId ?? null,
          metadata: { label: activated.label },
        });

        return toAcademicYearView(activated, terms);
      }

      const closed = yearRepository.close(yearId, updatedAt);
      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_YEAR_CLOSE',
        targetType: 'academic_year',
        targetId: yearId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { label: closed.label },
      });

      return toAcademicYearView(closed, termRepository.listForAcademicYear(yearId));
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw academicYearsForbidden();
    }
  }
}

function toAcademicYearView(year: AcademicYearRecord, terms: TermRecord[]): AcademicYearWithTerms {
  return {
    id: year.id,
    schoolId: year.schoolId,
    label: year.label,
    startDate: year.startDate,
    endDate: year.endDate,
    status: year.status,
    isCurrent: year.isCurrent,
    terms: terms.map((termItem) => ({
      id: termItem.id,
      label: termItem.label,
      termNumber: termItem.termNumber,
      startDate: termItem.startDate,
      endDate: termItem.endDate,
      isCurrent: termItem.isCurrent,
    })),
  };
}
