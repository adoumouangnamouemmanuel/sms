import {
  createAppreciationRepository,
  createAuditLogRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import { validateAppreciationScale } from '@edutrack/domain';
import type {
  AppreciationScaleInput,
  AppreciationScalesResponse,
  AppreciationScaleView,
} from '@edutrack/shared';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import {
  appreciationForbidden,
  appreciationImmutable,
  appreciationInvalid,
  appreciationNotFound,
} from './configuration.errors.js';

export interface AppreciationServiceOptions {
  now?: () => Date;
}

/**
 * Appreciation service (roadmap §9.10, design §14). Scales are versioned
 * like grading policies: drafts are editable, publication validates bands
 * (contiguity, no overlap, full coverage), published scales are immutable
 * and the duplicate endpoint creates the next version - finalized records
 * never re-read changed labels or thresholds.
 */
export class AppreciationService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: AppreciationServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser): AppreciationScalesResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createAppreciationRepository(this.db, tenant);

    return {
      scales: repository.list().map(toScaleView),
    };
  }

  createDraft(
    actor: AuthenticatedUser,
    input: AppreciationScaleInput,
    requestContext: RequestAuditContext = {}
  ): AppreciationScaleView {
    this.assertSchoolMaster(actor);
    this.validate(input);
    const tenant = createTenantContext(actor.schoolId);
    const logicalScaleId = randomUUID();

    const scaleId = withTransaction(this.db, (transaction) => {
      const repository = createAppreciationRepository(transaction, tenant);
      const id = repository.createDraft({ logicalScaleId, version: 1, scale: input });

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_APPRECIATION_UPDATE',
        targetType: 'appreciation_scale',
        targetId: id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { logicalScaleId, version: 1, name: input.name },
      });

      return id;
    });

    const created = createAppreciationRepository(this.db, tenant).find(scaleId);
    if (!created) {
      throw appreciationNotFound();
    }
    return toScaleView(created);
  }

  updateDraft(
    actor: AuthenticatedUser,
    scaleId: string,
    input: AppreciationScaleInput,
    requestContext: RequestAuditContext = {}
  ): AppreciationScaleView {
    this.assertSchoolMaster(actor);
    this.validate(input);
    const tenant = createTenantContext(actor.schoolId);

    withTransaction(this.db, (transaction) => {
      const repository = createAppreciationRepository(transaction, tenant);
      const existing = repository.find(scaleId);
      if (!existing) {
        throw appreciationNotFound();
      }
      if (existing.status !== 'DRAFT') {
        throw appreciationImmutable();
      }

      repository.replaceDraft(scaleId, input, this.now().toISOString());

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_APPRECIATION_UPDATE',
        targetType: 'appreciation_scale',
        targetId: scaleId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { version: existing.version, name: input.name },
      });
    });

    const updated = createAppreciationRepository(this.db, tenant).find(scaleId);
    if (!updated) {
      throw appreciationNotFound();
    }
    return toScaleView(updated);
  }

  publish(
    actor: AuthenticatedUser,
    scaleId: string,
    requestContext: RequestAuditContext = {}
  ): AppreciationScaleView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const publishedAt = this.now().toISOString();

    withTransaction(this.db, (transaction) => {
      const repository = createAppreciationRepository(transaction, tenant);
      const existing = repository.find(scaleId);
      if (!existing) {
        throw appreciationNotFound();
      }
      if (existing.status !== 'DRAFT') {
        throw appreciationImmutable();
      }

      const issues = validateAppreciationScale({
        name: existing.name,
        scaleMax: existing.scaleMax,
        bands: existing.bands.map((band) => ({
          lowerBound: band.lowerBound,
          upperBound: band.upperBound,
          labelFr: band.labelFr,
          labelAr: band.labelAr,
          labelEn: band.labelEn,
          shortLabel: band.shortLabel,
          displayOrder: band.displayOrder,
        })),
      });
      if (issues.length > 0) {
        throw appreciationInvalid(issues);
      }

      // Supersede the previous published scale (there is one scale per school
      // in V1: the latest published wins for transcript preview).
      const previous = repository
        .list()
        .filter((scale) => scale.status === 'PUBLISHED' && scale.id !== scaleId);
      for (const old of previous) {
        repository.supersede(old.id, publishedAt);
      }

      repository.publish(scaleId, publishedAt);

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_APPRECIATION_PUBLISH',
        targetType: 'appreciation_scale',
        targetId: scaleId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { version: existing.version, logicalScaleId: existing.logicalScaleId },
      });
    });

    const published = createAppreciationRepository(this.db, tenant).find(scaleId);
    if (!published) {
      throw appreciationNotFound();
    }
    return toScaleView(published);
  }

  /** Next DRAFT version of a scale (published or draft source). */
  duplicate(
    actor: AuthenticatedUser,
    scaleId: string,
    requestContext: RequestAuditContext = {}
  ): AppreciationScaleView {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);

    const newScaleId = withTransaction(this.db, (transaction) => {
      const repository = createAppreciationRepository(transaction, tenant);
      const existing = repository.find(scaleId);
      if (!existing) {
        throw appreciationNotFound();
      }

      const nextVersion = existing.version + 1;
      const id = repository.createDraft({
        logicalScaleId: existing.logicalScaleId,
        version: nextVersion,
        scale: {
          name: existing.name,
          scaleMax: existing.scaleMax,
          bands: existing.bands.map((band) => ({
            lowerBound: band.lowerBound,
            upperBound: band.upperBound,
            labelFr: band.labelFr,
            labelAr: band.labelAr,
            labelEn: band.labelEn,
            shortLabel: band.shortLabel,
            displayOrder: band.displayOrder,
          })),
        },
      });

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_APPRECIATION_UPDATE',
        targetType: 'appreciation_scale',
        targetId: id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { logicalScaleId: existing.logicalScaleId, version: nextVersion, source: scaleId },
      });

      return id;
    });

    const created = createAppreciationRepository(this.db, tenant).find(newScaleId);
    if (!created) {
      throw appreciationNotFound();
    }
    return toScaleView(created);
  }

  private validate(input: AppreciationScaleInput): void {
    const issues = validateAppreciationScale(input);
    if (issues.length > 0) {
      throw appreciationInvalid(issues);
    }
  }

  private assertSchoolMaster(actor: AuthenticatedUser): void {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw appreciationForbidden();
    }
  }
}

function toScaleView(scale: {
  id: string;
  logicalScaleId: string;
  version: number;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scaleMax: number;
  publishedAt: string | null;
  createdAt: string;
  bands: {
    id: string;
    lowerBound: number;
    upperBound: number;
    labelFr: string;
    labelAr: string;
    labelEn: string;
    shortLabel: string;
    displayOrder: number;
  }[];
}): AppreciationScaleView {
  return {
    id: scale.id,
    logicalScaleId: scale.logicalScaleId,
    version: scale.version,
    name: scale.name,
    status: scale.status,
    scaleMax: scale.scaleMax,
    bands: scale.bands.map((band) => ({
      id: band.id,
      lowerBound: band.lowerBound,
      upperBound: band.upperBound,
      labelFr: band.labelFr,
      labelAr: band.labelAr,
      labelEn: band.labelEn,
      shortLabel: band.shortLabel,
      displayOrder: band.displayOrder,
    })),
    publishedAt: scale.publishedAt,
    createdAt: scale.createdAt,
  };
}
