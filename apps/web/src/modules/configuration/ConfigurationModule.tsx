import {
  CONFIGURATION_AREAS,
  type AcademicYearStatusRequest,
  type AcademicYearWithTerms,
  type AcademicYearsResponse,
  type AppreciationScaleInput,
  type AppreciationScaleView,
  type AppreciationScalesResponse,
  type ConfigurationArea,
  type ConfigurationReadinessResponse,
  type ConfigurationReadinessStatus,
  type ConfigRequirement,
  type CreateAcademicYearRequest,
  type GradingPoliciesResponse,
  type GradingPolicyConfig,
  type GradingPolicyDetailResponse,
  type PolicyScopeAssignment,
  type SchoolCapability,
  type SetupSchoolProfileRequest,
  type SetupStateResponse,
} from '@edutrack/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AcademicYearsSection } from './AcademicYearsSection';
import { AppreciationSection } from './AppreciationSection';
import { GradingPolicySection } from './GradingPolicySection';
import { SchoolProfileSection } from './SchoolProfileSection';
import {
  ConfigurationApiError,
  fetchConfigurationReadiness,
  resolveConfigurationErrorMessageKey,
} from './configurationApi';

export interface ConfigurationModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  /** Test seam: replaces the network client. */
  client?: ConfigurationClient;
  /** Navigates to another school module (e.g. the profile or structure screens). */
  onNavigate?: (module: 'SCHOOL_SETUP' | 'CLASSES') => void;
  onSessionExpired?: () => void;
  /** Shared school state (profile, years, levels) for the embedded editors. */
  setupState?: SetupStateResponse;
  onSetupStateChange?: (state: SetupStateResponse) => void;
}

export interface ConfigurationClient {
  loadReadiness: () => Promise<ConfigurationReadinessResponse>;
  /** Academic years (roadmap §9.3). Optional test seams - the real client uses the API. */
  listAcademicYears?: () => Promise<AcademicYearsResponse>;
  createAcademicYear?: (input: CreateAcademicYearRequest) => Promise<AcademicYearWithTerms>;
  changeAcademicYearStatus?: (
    yearId: string,
    input: AcademicYearStatusRequest
  ) => Promise<AcademicYearWithTerms>;
  /** School profile (roadmap §9.2) - optional test seam. */
  saveProfile?: (input: SetupSchoolProfileRequest) => Promise<SetupStateResponse>;
  /** Grading policies (roadmap §9.7-§9.9) - optional test seams. */
  listGradingPolicies?: () => Promise<GradingPoliciesResponse>;
  createGradingPolicy?: (config: GradingPolicyConfig) => Promise<GradingPolicyDetailResponse>;
  updateGradingPolicy?: (
    policyId: string,
    config: GradingPolicyConfig
  ) => Promise<GradingPolicyDetailResponse>;
  publishGradingPolicy?: (policyId: string) => Promise<GradingPolicyDetailResponse>;
  duplicateGradingPolicy?: (policyId: string) => Promise<GradingPolicyDetailResponse>;
  assignPolicyScopes?: (
    policyId: string,
    scopes: PolicyScopeAssignment[]
  ) => Promise<GradingPolicyDetailResponse>;
  /** Appreciation scales (roadmap §9.10) - optional test seams. */
  listAppreciationScales?: () => Promise<AppreciationScalesResponse>;
  createAppreciationScale?: (input: AppreciationScaleInput) => Promise<AppreciationScaleView>;
  updateAppreciationScale?: (
    scaleId: string,
    input: AppreciationScaleInput
  ) => Promise<AppreciationScaleView>;
  publishAppreciationScale?: (scaleId: string) => Promise<AppreciationScaleView>;
  duplicateAppreciationScale?: (scaleId: string) => Promise<AppreciationScaleView>;
}

const AREA_ORDER: ConfigurationArea[] = [...CONFIGURATION_AREAS];

const CAPABILITY_ORDER: SchoolCapability[] = [
  'CLASSROOM_MANAGEMENT',
  'CURRICULUM_CONFIGURATION',
  'GRADE_ENTRY',
  'GRADE_SUBMISSION',
  'GRADE_VALIDATION',
  'TRANSCRIPT_CALCULATION',
  'PDF_GENERATION',
];

export function ConfigurationModule({
  apiBaseUrl,
  capabilityToken,
  client,
  onNavigate,
  onSessionExpired,
  setupState,
  onSetupStateChange,
}: ConfigurationModuleProps) {
  const { t } = useTranslation();
  const [readiness, setReadiness] = useState<ConfigurationReadinessResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // The shell recreates onSessionExpired on every render; a ref keeps the
  // readiness fetch (and the page flash that comes with it) from re-running
  // on each parent re-render while keeping the callback usable.
  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  useEffect(() => {
    let cancelled = false;

    async function loadReadiness() {
      setIsLoading(true);
      setErrorKey(null);

      try {
        const state = client
          ? await client.loadReadiness()
          : await fetchConfigurationReadiness(apiBaseUrl ?? '', {
              ...(capabilityToken ? { capabilityToken } : {}),
            });

        if (!cancelled) {
          setReadiness(state);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ConfigurationApiError && error.code === 'INVALID_ACCESS_TOKEN') {
            onSessionExpiredRef.current?.();
            return;
          }

          setErrorKey(resolveConfigurationErrorMessageKey(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, capabilityToken, client]);

  const readyAreas = readiness?.areas.filter((area) => area.status === 'READY').length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-2xl lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/20 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-[80px]"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-300/80">
              {t('configuration.hero.eyebrow')}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              {t('configuration.title')}
            </h1>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-300">
              {t('configuration.hero.subtitle')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/15 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-teal-200 backdrop-blur-md">
              {t('configuration.hero.readiness', {
                ready: String(readyAreas),
                total: String(readiness?.areas.length ?? 0),
              })}
            </span>
            <p className="text-[11px] font-bold text-slate-400">
              {t('configuration.hero.liveNote')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Status ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div
          aria-live="polite"
          className="flex h-40 w-full items-center justify-center"
          role="status"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
            <p className="text-xs font-bold text-slate-400">{t('configuration.loading')}</p>
          </div>
        </div>
      ) : errorKey ? (
        <section
          aria-live="polite"
          className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-bold text-red-700">{t(errorKey)}</p>
          <button
            className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            onClick={() => {
              window.location.reload();
            }}
            type="button"
          >
            {t('configuration.retry')}
          </button>
        </section>
      ) : readiness ? (
        <>
          {/* ── Areas ─────────────────────────────────────────────────────── */}
          <section className="space-y-3" aria-labelledby="configuration-areas-title">
            <div className="flex items-center gap-2">
              <h2
                className="text-sm font-black uppercase tracking-wider text-slate-500"
                id="configuration-areas-title"
              >
                {t('configuration.areas.title')}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AREA_ORDER.map((area) => {
                const state = readiness.areas.find((item) => item.area === area);

                return state ? (
                  <article
                    className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                    key={area}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[15px] font-black text-slate-800">{state.label}</h3>
                      <StatusPill status={state.status} label={areaStatusLabel(t, state.status)} />
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
                      {state.status === 'READY'
                        ? t('configuration.areas.readyHint')
                        : t('configuration.areas.notReadyHint')}
                    </p>
                  </article>
                ) : null;
              })}
            </div>
          </section>

          {/* ── Capabilities ──────────────────────────────────────────────── */}
          <section className="space-y-3" aria-labelledby="configuration-capabilities-title">
            <div className="flex items-center gap-2">
              <h2
                className="text-sm font-black uppercase tracking-wider text-slate-500"
                id="configuration-capabilities-title"
              >
                {t('configuration.capabilities.title')}
              </h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              {CAPABILITY_ORDER.map((capability, index) => {
                const state = readiness.capabilities.find((item) => item.capability === capability);

                return state ? (
                  <div
                    className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                      index > 0 ? 'border-t border-slate-100' : ''
                    }`}
                    key={capability}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            state.status === 'READY' ? 'bg-teal-500' : 'bg-amber-400'
                          }`}
                        />
                        <h3 className="text-sm font-black text-slate-800">{state.label}</h3>
                      </div>
                      {state.status === 'NOT_READY' ? (
                        <ul className="mt-1.5 space-y-1">
                          {state.missing.map((requirement) => (
                            <li
                              className="flex items-start gap-1.5 text-xs font-semibold text-slate-500"
                              key={requirement}
                            >
                              <span aria-hidden="true" className="mt-0.5 text-amber-500">
                                •
                              </span>
                              <span>{requirementMessage(t, requirement)}</span>
                            </li>
                          ))}
                          {state.blockedBy.map((blockedBy) => {
                            const blockedLabel = readiness.capabilities.find(
                              (item) => item.capability === blockedBy
                            )?.label;

                            return blockedLabel ? (
                              <li
                                className="flex items-start gap-1.5 text-xs font-semibold text-slate-500"
                                key={`blocked-${blockedBy}`}
                              >
                                <span aria-hidden="true" className="mt-0.5 text-slate-400">
                                  ↳
                                </span>
                                <span>
                                  {t('configuration.capabilities.blockedBy', {
                                    capability: blockedLabel,
                                  })}
                                </span>
                              </li>
                            ) : null;
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs font-semibold text-teal-600">
                          {t('configuration.capabilities.readyHint')}
                        </p>
                      )}
                    </div>
                    <StatusPill
                      status={state.status}
                      label={capabilityStatusLabel(t, state.status)}
                    />
                  </div>
                ) : null;
              })}
            </div>
          </section>

          {/* ── School profile ────────────────────────────────────────────── */}
          {setupState ? (
            <SchoolProfileSection
              apiBaseUrl={apiBaseUrl}
              {...(capabilityToken ? { capabilityToken } : {})}
              {...(client?.saveProfile ? { client: { saveProfile: client.saveProfile } } : {})}
              {...(onSetupStateChange ? { onSetupStateChange } : {})}
              {...(onSessionExpired ? { onSessionExpired } : {})}
              setupState={setupState}
            />
          ) : null}

          {/* ── Academic years ────────────────────────────────────────────── */}
          <AcademicYearsSection
            apiBaseUrl={apiBaseUrl}
            {...(capabilityToken ? { capabilityToken } : {})}
            {...(client ? { client } : {})}
            {...(onSessionExpired ? { onSessionExpired } : {})}
          />

          {/* ── Grading policy ────────────────────────────────────────────── */}
          <GradingPolicySection
            apiBaseUrl={apiBaseUrl}
            {...(capabilityToken ? { capabilityToken } : {})}
            {...(client
              ? {
                  client: {
                    ...(client.listGradingPolicies ? { list: client.listGradingPolicies } : {}),
                    ...(client.createGradingPolicy ? { create: client.createGradingPolicy } : {}),
                    ...(client.updateGradingPolicy ? { update: client.updateGradingPolicy } : {}),
                    ...(client.publishGradingPolicy
                      ? { publish: client.publishGradingPolicy }
                      : {}),
                    ...(client.duplicateGradingPolicy
                      ? { duplicate: client.duplicateGradingPolicy }
                      : {}),
                    ...(client.assignPolicyScopes
                      ? { assignScopes: client.assignPolicyScopes }
                      : {}),
                  },
                }
              : {})}
            {...(onSessionExpired ? { onSessionExpired } : {})}
          />

          {/* ── Appreciation ──────────────────────────────────────────────── */}
          <AppreciationSection
            apiBaseUrl={apiBaseUrl}
            {...(capabilityToken ? { capabilityToken } : {})}
            {...(client
              ? {
                  client: {
                    ...(client.listAppreciationScales
                      ? { list: client.listAppreciationScales }
                      : {}),
                    ...(client.createAppreciationScale
                      ? { create: client.createAppreciationScale }
                      : {}),
                    ...(client.updateAppreciationScale
                      ? { update: client.updateAppreciationScale }
                      : {}),
                    ...(client.publishAppreciationScale
                      ? { publish: client.publishAppreciationScale }
                      : {}),
                    ...(client.duplicateAppreciationScale
                      ? { duplicate: client.duplicateAppreciationScale }
                      : {}),
                  },
                }
              : {})}
            {...(onSessionExpired ? { onSessionExpired } : {})}
          />

          {/* ── Quick links ───────────────────────────────────────────────── */}
          <section className="space-y-3" aria-labelledby="configuration-links-title">
            <div className="flex items-center gap-2">
              <h2
                className="text-sm font-black uppercase tracking-wider text-slate-500"
                id="configuration-links-title"
              >
                {t('configuration.links.title')}
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="cursor-pointer rounded-xl border border-slate-200/70 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                onClick={() => onNavigate?.('SCHOOL_SETUP')}
                type="button"
              >
                {t('configuration.links.profile')}
              </button>
              <button
                className="cursor-pointer rounded-xl border border-slate-200/70 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                onClick={() => onNavigate?.('CLASSES')}
                type="button"
              >
                {t('configuration.links.structure')}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ status, label }: { status: ConfigurationReadinessStatus; label: string }) {
  const isReady = status === 'READY';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
        isReady
          ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200'
          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${isReady ? 'bg-teal-500' : 'bg-amber-500'}`}
      />
      {label}
    </span>
  );
}

function areaStatusLabel(t: (key: string) => string, status: ConfigurationReadinessStatus) {
  return status === 'READY' ? t('configuration.areas.ready') : t('configuration.areas.notReady');
}

function capabilityStatusLabel(t: (key: string) => string, status: ConfigurationReadinessStatus) {
  return status === 'READY'
    ? t('configuration.capabilities.ready')
    : t('configuration.capabilities.notReady');
}

function requirementMessage(t: (key: string) => string, requirement: ConfigRequirement) {
  return t(`configuration.requirements.${requirement}`);
}
