import {
  createAuditLogRepository,
  createGradingPolicyRepository,
  createTenantContext,
  withTransaction,
  type EduTrackDatabase,
} from '@edutrack/db';
import {
  resolvePolicyScope,
  validatePolicyForPublication,
} from '@edutrack/domain';
import type {
  AssignPolicyScopesRequest,
  GradingPoliciesResponse,
  GradingPolicyConfig,
  GradingPolicyDetail,
  GradingPolicyDetailResponse,
  PolicyScopeAssignment,
  ResolvedPolicyResponse,
} from '@edutrack/shared';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser, RequestAuditContext } from '../auth/index.js';
import {
  gradingPolicyForbidden,
  gradingPolicyImmutable,
  gradingPolicyInvalid,
  gradingPolicyInvalidTransition,
  gradingPolicyNotFound,
  gradingPolicyScopeConflict,
} from './configuration.errors.js';

export interface GradingPolicyServiceOptions {
  now?: () => Date;
}

/**
 * Grading-policy service (roadmap §9.7-§9.9, design §6-§11).
 *
 * Writes are SchoolMaster-only. Drafts are freely editable; publishing runs
 * the pure domain validation (graph, weights, scales) and enforces scope
 * uniqueness against other PUBLISHED policies. Published policies are
 * immutable - the duplicate endpoint creates the next version, so existing
 * grades never re-read changed definitions.
 */
export class GradingPolicyService {
  private readonly now: () => Date;

  constructor(
    private readonly db: EduTrackDatabase,
    options: GradingPolicyServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  list(actor: AuthenticatedUser): GradingPoliciesResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createGradingPolicyRepository(this.db, tenant);

    return {
      policies: repository.listSummaries().map((summary) => ({
        id: summary.id,
        logicalPolicyId: summary.logicalPolicyId,
        version: summary.version,
        name: summary.name,
        status: summary.status,
        scaleMax: summary.scaleMax,
        passThreshold: summary.passThreshold,
        decimalPrecision: summary.decimalPrecision,
        roundingMode: summary.roundingMode,
        effectiveAcademicYearId: summary.effectiveAcademicYearId,
        publishedAt: summary.publishedAt,
        createdAt: summary.createdAt,
      })),
      scopes: repository.listAllScopes().map(mapScopeView),
    };
  }

  get(actor: AuthenticatedUser, policyId: string): GradingPolicyDetailResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createGradingPolicyRepository(this.db, tenant);

    const detail = repository.findDetail(policyId);
    if (!detail) {
      throw gradingPolicyNotFound();
    }

    return {
      policy: toPolicyDetail(detail.header, detail.config),
      scopes: repository.listScopes(policyId).map(mapScopeView),
    };
  }

  createDraft(
    actor: AuthenticatedUser,
    config: GradingPolicyConfig,
    requestContext: RequestAuditContext = {}
  ): GradingPolicyDetailResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();
    const logicalPolicyId = randomUUID();

    const policyId = withTransaction(this.db, (transaction) => {
      const repository = createGradingPolicyRepository(transaction, tenant);
      const id = repository.createDraft(
        {
          logicalPolicyId,
          version: 1,
          createdBy: actor.id,
          config,
        },
        updatedAt
      );

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_POLICY_CREATE',
        targetType: 'grading_policy',
        targetId: id,
        correlationId: requestContext.correlationId ?? null,
        metadata: { logicalPolicyId, version: 1, name: config.name },
      });

      return id;
    });

    return this.get(actor, policyId);
  }

  updateDraft(
    actor: AuthenticatedUser,
    policyId: string,
    config: GradingPolicyConfig,
    requestContext: RequestAuditContext = {}
  ): GradingPolicyDetailResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    withTransaction(this.db, (transaction) => {
      const repository = createGradingPolicyRepository(transaction, tenant);
      const existing = repository.findSummary(policyId);
      if (!existing) {
        throw gradingPolicyNotFound();
      }
      if (existing.status !== 'DRAFT') {
        throw gradingPolicyImmutable();
      }

      repository.replaceDraftConfig(policyId, config, updatedAt);

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_POLICY_UPDATE',
        targetType: 'grading_policy',
        targetId: policyId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { version: existing.version, name: config.name },
      });
    });

    return this.get(actor, policyId);
  }

  /**
   * Publishes a draft after full domain validation. Any other PUBLISHED
   * policy in the same school with an overlapping scope is rejected, and the
   * previous version of the same logical policy (if published) is marked
   * SUPERSEDED.
   */
  publish(
    actor: AuthenticatedUser,
    policyId: string,
    requestContext: RequestAuditContext = {}
  ): GradingPolicyDetailResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const publishedAt = this.now().toISOString();

    withTransaction(this.db, (transaction) => {
      const repository = createGradingPolicyRepository(transaction, tenant);
      const existing = repository.findDetail(policyId);
      if (!existing) {
        throw gradingPolicyNotFound();
      }
      if (existing.header.status !== 'DRAFT') {
        throw gradingPolicyInvalidTransition();
      }

      const issues = validatePolicyForPublication(existing.config);
      if (issues.length > 0) {
        throw gradingPolicyInvalid(issues);
      }

      // Scope uniqueness against other published policies (own scopes only
      // count after publication, so a draft's scopes cannot conflict with
      // themselves). Soft-deleted scope rows are excluded.
      const allScopes = repository.listAllScopes().filter((scope) => scope.policyId !== policyId);
      const publishedPolicies = new Set(
        repository
          .listSummaries()
          .filter((policy) => policy.status === 'PUBLISHED')
          .map((policy) => policy.id)
      );
      const conflicting = allScopes.filter((scope) => publishedPolicies.has(scope.policyId));

      for (const scope of repository.listScopes(policyId)) {
        const sameScope = conflicting.some(
          (other) =>
            other.scopeType === scope.scopeType &&
            other.levelId === scope.levelId &&
            other.subjectId === scope.subjectId
        );
        if (sameScope) {
          throw gradingPolicyScopeConflict();
        }
      }

      // Supersede the previous published version of the same logical policy.
      const sameLogical = repository
        .listSummaries()
        .filter(
          (policy) =>
            policy.logicalPolicyId === existing.header.logicalPolicyId &&
            policy.status === 'PUBLISHED' &&
            policy.id !== policyId
        );
      for (const previous of sameLogical) {
        repository.supersede(previous.id, publishedAt);
      }

      repository.publish(
        policyId,
        actor.id,
        publishedAt,
        sameLogical[0]?.id ?? null
      );

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_POLICY_PUBLISH',
        targetType: 'grading_policy',
        targetId: policyId,
        correlationId: requestContext.correlationId ?? null,
        metadata: {
          version: existing.header.version,
          logicalPolicyId: existing.header.logicalPolicyId,
          supersedes: sameLogical[0]?.id ?? null,
        },
      });
    });

    return this.get(actor, policyId);
  }

  /** Creates the next DRAFT version of a policy (published or draft source). */
  duplicate(
    actor: AuthenticatedUser,
    policyId: string,
    requestContext: RequestAuditContext = {}
  ): GradingPolicyDetailResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    const newPolicyId = withTransaction(this.db, (transaction) => {
      const repository = createGradingPolicyRepository(transaction, tenant);
      const existing = repository.findDetail(policyId);
      if (!existing) {
        throw gradingPolicyNotFound();
      }

      const nextVersion = existing.header.version + 1;
      const id = repository.createDraft(
        {
          logicalPolicyId: existing.header.logicalPolicyId,
          version: nextVersion,
          createdBy: actor.id,
          config: existing.config,
        },
        updatedAt
      );

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_POLICY_CREATE',
        targetType: 'grading_policy',
        targetId: id,
        correlationId: requestContext.correlationId ?? null,
        metadata: {
          logicalPolicyId: existing.header.logicalPolicyId,
          version: nextVersion,
          source: policyId,
        },
      });

      return id;
    });

    return this.get(actor, newPolicyId);
  }

  replaceScopes(
    actor: AuthenticatedUser,
    policyId: string,
    input: AssignPolicyScopesRequest,
    requestContext: RequestAuditContext = {}
  ): GradingPolicyDetailResponse {
    this.assertSchoolMaster(actor);
    const tenant = createTenantContext(actor.schoolId);
    const updatedAt = this.now().toISOString();

    withTransaction(this.db, (transaction) => {
      const repository = createGradingPolicyRepository(transaction, tenant);
      const existing = repository.findSummary(policyId);
      if (!existing) {
        throw gradingPolicyNotFound();
      }

      // Scope slots are unique per scope type even across drafts; a conflict
      // with a PUBLISHED policy is a hard 409 so the school never silently
      // loses coverage. Draft-to-draft reassignment is allowed (the old
      // policy just loses the scope).
      const allScopes = repository.listAllScopes().filter((scope) => scope.policyId !== policyId);
      const publishedIds = new Set(
        repository
          .listSummaries()
          .filter((policy) => policy.status === 'PUBLISHED')
          .map((policy) => policy.id)
      );

      for (const scope of input.scopes) {
        const conflicting = allScopes.some(
          (other) =>
            other.scopeType === scope.scopeType &&
            other.levelId === scope.levelId &&
            other.subjectId === scope.subjectId &&
            publishedIds.has(other.policyId)
        );
        if (conflicting) {
          throw gradingPolicyScopeConflict();
        }
      }

      repository.replaceScopes(
        policyId,
        input.scopes.map((scope) => ({
          scopeType: scope.scopeType,
          levelId: scope.levelId,
          subjectId: scope.subjectId,
        })),
        updatedAt
      );

      createAuditLogRepository(transaction, tenant).createEvent({
        actorUserId: actor.id,
        action: 'CONFIG_POLICY_UPDATE',
        targetType: 'grading_policy',
        targetId: policyId,
        correlationId: requestContext.correlationId ?? null,
        metadata: { scopes: input.scopes.length },
      });
    });

    return this.get(actor, policyId);
  }

  /**
   * Resolves the published policy for a (level, subject) scope using the
   * `school default -> level -> level + subject` hierarchy (design §5.1).
   * Any authenticated user may read the resolution - grade entry shows it.
   */
  resolve(actor: AuthenticatedUser, levelId: string, subjectId: string | null): ResolvedPolicyResponse {
    const tenant = createTenantContext(actor.schoolId);
    const repository = createGradingPolicyRepository(this.db, tenant);

    const published = repository
      .listDetails()
      .filter((detail) => detail.header.status === 'PUBLISHED');

    const resolution = resolvePolicyScope(
      {
        policies: published.map((detail) => ({
          policyId: detail.header.id,
          scopes: repository.listScopes(detail.header.id).map((scope) => ({
            scopeType: scope.scopeType,
            levelId: scope.levelId,
            subjectId: scope.subjectId,
          })),
        })),
      },
      levelId,
      subjectId
    );

    if (!resolution) {
      return {
        resolved: null,
        explanation:
          "Aucune politique publiée ne couvre ce niveau. Configurez la politique par défaut de l'école pour débloquer la saisie des notes.",
      };
    }

    const detail = published.find((item) => item.header.id === resolution.policyId);
    if (!detail) {
      return {
        resolved: null,
        explanation: 'La politique résolue est introuvable.',
      };
    }

    return {
      resolved: {
        policyId: detail.header.id,
        name: detail.header.name,
        version: detail.header.version,
        matchedScope: resolution.matchedScope,
        policy: toPolicyDetail(detail.header, detail.config),
      },
      explanation: resolutionExplanation(resolution.matchedScope),
    };
  }

  private assertSchoolMaster(actor: AuthenticatedUser): void {
    if (actor.role !== 'SCHOOL_MASTER') {
      throw gradingPolicyForbidden();
    }
  }
}

function toPolicyDetail(
  header: {
    id: string;
    logicalPolicyId: string;
    version: number;
    name: string;
    status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
    scaleMax: number;
    passThreshold: number;
    decimalPrecision: number;
    roundingMode: 'HALF_UP' | 'TRUNCATE';
    effectiveAcademicYearId: string | null;
    publishedAt: string | null;
    createdAt: string;
  },
  config: GradingPolicyConfig
): GradingPolicyDetail {
  return {
    id: header.id,
    logicalPolicyId: header.logicalPolicyId,
    version: header.version,
    name: header.name,
    status: header.status,
    scaleMax: header.scaleMax,
    passThreshold: header.passThreshold,
    decimalPrecision: header.decimalPrecision,
    roundingMode: header.roundingMode,
    effectiveAcademicYearId: header.effectiveAcademicYearId,
    publishedAt: header.publishedAt,
    createdAt: header.createdAt,
    assessmentTypes: config.assessmentTypes,
    derivedResults: config.derivedResults,
    subjectResult: config.subjectResult,
  };
}

function mapScopeView(scope: {
  id: string;
  policyId: string;
  scopeType: 'SCHOOL_DEFAULT' | 'LEVEL' | 'LEVEL_SUBJECT';
  levelId: string | null;
  subjectId: string | null;
}) {
  return {
    id: scope.id,
    policyId: scope.policyId,
    scopeType: scope.scopeType,
    levelId: scope.levelId,
    subjectId: scope.subjectId,
  };
}

function resolutionExplanation(matchedScope: PolicyScopeAssignment['scopeType']): string {
  switch (matchedScope) {
    case 'SCHOOL_DEFAULT':
      return 'Cette matière utilise la politique par défaut de l\u2019école.';
    case 'LEVEL':
      return 'Cette matière hérite de la politique du niveau.';
    case 'LEVEL_SUBJECT':
      return 'Cette matière utilise sa propre politique personnalisée.';
    default: {
      const exhaustive: never = matchedScope;
      return exhaustive;
    }
  }
}

