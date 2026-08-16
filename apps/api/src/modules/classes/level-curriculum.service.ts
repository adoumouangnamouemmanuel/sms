import {
  createClassLevelRepository,
  createAuditLogRepository,
  createLevelSubjectRepository,
  createSubjectRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import type { LevelCurriculumsResponse, SaveLevelCurriculumRequest } from '@edutrack/shared';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import { classesForbidden, levelCurriculumNotFound } from './classes.errors.js';

export interface LevelCurriculumServiceOptions {
  now?: () => Date;
}

/**
 * Level-scope curriculum service (roadmap §9.5, design §4.3). Coefficients
 * and requirements live once per level and are inherited by every classroom
 * of that level; the operational per-class records stay in class_subject.
 * Saving replaces the level's matrix atomically inside one transaction.
 */
export class LevelCurriculumService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: LevelCurriculumServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser): LevelCurriculumsResponse {
    const tenant = createTenantContext(actor.schoolId);
    const levelRepository = createClassLevelRepository(this.db, tenant);
    const levelSubjectRepository = createLevelSubjectRepository(this.db, tenant);

    const levels = levelRepository.listActive();

    return {
      items: levels.map((level) => ({
        levelId: level.id,
        levelCode: level.code,
        levelName: level.name,
        entries: levelSubjectRepository.listForLevel(level.id),
      })),
    };
  }

  save(
    actor: AuthenticatedUser,
    input: SaveLevelCurriculumRequest,
    requestContext: RequestAuditContext = {}
  ): LevelCurriculumsResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    return withTransaction(this.db, (transaction) => {
      const levelRepository = createClassLevelRepository(transaction, tenant);
      const subjectRepository = createSubjectRepository(transaction, tenant);
      const levelSubjectRepository = createLevelSubjectRepository(transaction, tenant);

      const level = levelRepository.findById(input.levelId);
      if (!level?.isActive) {
        throw levelCurriculumNotFound();
      }

      const activeSubjectIds = new Set(
        subjectRepository.list({ status: 'active' }).map((subjectItem) => subjectItem.id)
      );

      for (const entry of input.entries) {
        if (!activeSubjectIds.has(entry.subjectId)) {
          throw levelCurriculumNotFound();
        }
      }

      levelSubjectRepository.replaceForLevel(
        input.levelId,
        input.entries.map((entry) => ({
          subjectId: entry.subjectId,
          coefficient: entry.coefficient,
          isRequired: entry.isRequired,
        })),
        updatedAt
      );

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_LEVEL_UPDATE',
        targetType: 'class_level',
        targetId: input.levelId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { subjectCount: input.entries.length },
      });

      const levels = levelRepository.listActive();

      return {
        items: levels.map((levelItem) => ({
          levelId: levelItem.id,
          levelCode: levelItem.code,
          levelName: levelItem.name,
          entries: levelSubjectRepository.listForLevel(levelItem.id),
        })),
      };
    });
  }

  private assertSchoolMaster(actor: AuthenticatedUser) {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw classesForbidden();
    }
  }
}
