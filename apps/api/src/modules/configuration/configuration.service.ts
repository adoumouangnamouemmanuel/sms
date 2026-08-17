import {
  createConfigurationRepository,
  createTenantContext,
  type EduTrackDatabase,
} from '@edutrack/db';
import { evaluateConfigurationReadiness } from '@edutrack/domain';
import {
  CONFIGURATION_AREA_LABELS,
  type ConfigurationReadinessResponse,
  type ConfigurationReadinessState,
  type ConfigurationSnapshot,
  type SchoolCapability,
} from '@edutrack/shared';
import type { AuthenticatedUser } from '../auth/index.js';
import { configurationFailed, configurationNotReady } from './configuration.errors.js';

const CAPABILITY_LABELS: Record<SchoolCapability, string> = {
  CLASSROOM_MANAGEMENT: 'Gérer les classes',
  CURRICULUM_CONFIGURATION: 'Configurer le curriculum',
  GRADE_ENTRY: 'Saisir les notes',
  GRADE_SUBMISSION: 'Soumettre les notes',
  GRADE_VALIDATION: 'Valider les notes',
  TRANSCRIPT_CALCULATION: 'Calculer les bulletins',
  PDF_GENERATION: 'Générer les PDF',
};

/**
 * Application service for the permanent Configuration area (roadmap §9.1).
 *
 * Readiness is always computed from live, tenant-scoped data by the pure
 * domain evaluator - never cached and never trusted from the client. Any
 * authenticated user may read it (teachers need the blocked-message UX at
 * grade entry); the backend capability gate below stays the enforcement
 * point for every future configuration consumer.
 */
export class ConfigurationService {
  constructor(private readonly db: EduTrackDatabase) {}

  getReadiness(actor: AuthenticatedUser): ConfigurationReadinessResponse {
    const state = evaluateConfigurationReadiness(this.loadSnapshot(actor));
    return toReadinessResponse(state);
  }

  /**
   * Backend capability gate (design §23). Configuration consumers call this
   * before an operation that requires a ready capability; the UI alone is
   * never enough. Throws `CONFIGURATION_NOT_READY` with the missing
   * requirements when the school is not ready.
   */
  assertCapability(actor: AuthenticatedUser, capability: SchoolCapability): void {
    const state = evaluateConfigurationReadiness(this.loadSnapshot(actor));
    const capabilityState = state.capabilities.find((item) => item.capability === capability);

    if (capabilityState?.status !== 'READY') {
      throw configurationNotReady(capability, capabilityState?.missing ?? []);
    }
  }

  private loadSnapshot(actor: AuthenticatedUser): ConfigurationSnapshot {
    try {
      const tenant = createTenantContext(actor.schoolId);
      return createConfigurationRepository(this.db, tenant).getSnapshot();
    } catch {
      throw configurationFailed();
    }
  }
}

function toReadinessResponse(state: ConfigurationReadinessState): ConfigurationReadinessResponse {
  return {
    areas: state.areas.map((area) => ({
      area: area.area,
      status: area.status,
      label: CONFIGURATION_AREA_LABELS[area.area],
    })),
    capabilities: state.capabilities.map((capability) => ({
      capability: capability.capability,
      status: capability.status,
      label: CAPABILITY_LABELS[capability.capability],
      missing: capability.missing,
      blockedBy: capability.blockedBy,
    })),
  };
}
