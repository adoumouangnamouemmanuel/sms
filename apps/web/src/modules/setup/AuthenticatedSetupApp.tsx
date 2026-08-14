import {
  APP_NAME,
  type PublicAuthUser,
  type SchoolModuleName,
  type SetupStateResponse,
  type SetupStepId,
} from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLogoutAction, type LogoutClient } from '../auth';
import type { DesktopDeploymentStatus } from '../../desktopStatus';
import { SetupWizard } from './SetupWizard';
import { useSetupState, type SetupClient } from './useSetupState';
import { setupStepOrder, canOpenStep } from './setupSteps';

export interface AuthenticatedSetupAppProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  desktopStatus?: DesktopDeploymentStatus | null;
  logoutClient?: LogoutClient;
  onLoggedOut: () => void;
  setupClient?: SetupClient;
  user: PublicAuthUser;
}

export function AuthenticatedSetupApp({
  apiBaseUrl,
  capabilityToken,
  desktopStatus,
  logoutClient,
  onLoggedOut,
  setupClient,
  user,
}: AuthenticatedSetupAppProps) {
  const { t } = useTranslation();
  const setup = useSetupState({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(setupClient ? { client: setupClient } : {}),
  });
  const logoutAction = useLogoutAction({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(logoutClient ? { logoutClient } : {}),
    onLoggedOut,
  });
  const visibleModules = resolveVisibleModules(
    setup.state?.enabledModules.map((item) => item.moduleName)
  );

  const [activeStep, setActiveStep] = useState<SetupStepId | null>(null);
  const [isSetupAccordionOpen, setIsSetupAccordionOpen] = useState(true);
  const currentStep = activeStep ?? setup.state?.nextStep ?? null;

  return (
    <main className="h-screen overflow-hidden bg-slate-50 font-sans text-slate-950 flex flex-col">
      <div className="flex h-full lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="relative flex flex-col border-r border-slate-800/80 bg-slate-950 px-5 py-6 text-white shadow-2xl overflow-hidden z-30">
          {/* Deep background texture and glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-teal-900/40 via-transparent to-transparent pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-slate-800/40 via-transparent to-transparent pointer-events-none"></div>
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-teal-500/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute top-1/2 -right-32 w-96 h-96 bg-teal-900/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-[0.15] pointer-events-none mix-blend-overlay"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent pointer-events-none"></div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 text-lg font-black shadow-lg shadow-teal-950/30">
                E
              </div>
              <div>
                <p className="text-[17px] font-black leading-tight tracking-tight">{APP_NAME}</p>
                <p className="text-[10px] font-bold text-teal-400/80 tracking-[0.15em] uppercase mt-1.5">
                  {t('setup.shell.local')}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {t('setup.shell.session')}
              </p>
              <p className="mt-2 text-sm font-black text-white">{user.username}</p>
              <p className="text-xs font-semibold text-teal-200">{t(`auth.roles.${user.role}`)}</p>
            </div>

            <nav className="mt-8 space-y-2" aria-label={t('setup.shell.navigation')}>
              {visibleModules.map((moduleName) => {
                if (moduleName === 'SCHOOL_SETUP' && setup.state) {
                  const setupState = setup.state;
                  const selectedStep = currentStep ?? setupState.nextStep;
                  const activeIndex = setupStepOrder.indexOf(selectedStep);
                  return (
                    <div key={moduleName} className="flex flex-col gap-2">
                      <button
                        className="flex w-full items-center justify-between rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 px-4 py-3 text-left shadow-sm transition-all group cursor-pointer"
                        onClick={() => {
                          setIsSetupAccordionOpen(!isSetupAccordionOpen);
                        }}
                        type="button"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-3 text-sm font-black text-white">
                            <span className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                            {t(`setup.modules.${moduleName}`)} ({activeIndex + 1}/
                            {setupStepOrder.length})
                          </div>
                          {!isSetupAccordionOpen && currentStep ? (
                            <div className="mt-1 ml-5 text-xs font-semibold text-teal-200/80 group-hover:text-teal-200 transition-colors">
                              {t(`setup.steps.${currentStep}.title`)}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                          <svg
                            className={`h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-transform duration-300 ${isSetupAccordionOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {isSetupAccordionOpen && (
                        <div className="relative pl-6 pr-2 py-2">
                          <div
                            className="absolute left-[38px] top-4 bottom-4 w-px bg-white/10"
                            aria-hidden="true"
                          />
                          <div className="space-y-1">
                            {setupStepOrder.map((stepId, index) => {
                              const isOpen = canOpenStep(setupState, stepId);
                              const isActive = selectedStep === stepId;
                              const completedIndex =
                                setupState.school.setupStatus === 'COMPLETED'
                                  ? 999
                                  : setupStepOrder.indexOf(setupState.nextStep);
                              const isCompleted = index < completedIndex;

                              return (
                                <button
                                  className={`relative flex w-full cursor-pointer items-start gap-4 rounded-xl px-3 py-2.5 text-left transition group ${
                                    isActive
                                      ? 'bg-teal-500/20 text-white shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-teal-400 before:rounded-r-md'
                                      : isOpen
                                        ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                                        : 'text-slate-500 cursor-not-allowed opacity-60'
                                  }`}
                                  disabled={!isOpen}
                                  key={stepId}
                                  onClick={() => {
                                    setActiveStep(stepId);
                                  }}
                                  type="button"
                                >
                                  <span
                                    className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors mt-0.5 ${
                                      isActive
                                        ? 'bg-teal-500 text-teal-950 ring-2 ring-slate-950'
                                        : isCompleted
                                          ? 'bg-teal-500/30 text-teal-300 ring-2 ring-slate-950'
                                          : 'bg-slate-800 text-slate-500 ring-2 ring-slate-950'
                                    }`}
                                  >
                                    {isCompleted && !isActive ? (
                                      <svg
                                        className="w-3 h-3"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    ) : (
                                      index + 1
                                    )}
                                  </span>
                                  <span className="flex-1">
                                    <span
                                      className={`block text-[13px] font-bold ${isActive ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}
                                    >
                                      {t(`setup.steps.${stepId}.title`)}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-left text-sm font-black text-white shadow-sm hover:bg-white/15 transition-colors"
                    key={moduleName}
                    type="button"
                  >
                    <span className="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                    {t(`setup.modules.${moduleName}`)}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/10">
              {logoutAction.errorKey ? (
                <p className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
                  {t(logoutAction.errorKey)}
                </p>
              ) : null}
              <button
                className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-bold text-slate-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!apiBaseUrl || logoutAction.isSubmitting}
                onClick={() => {
                  void logoutAction.submit();
                }}
                type="button"
              >
                {logoutAction.isSubmitting ? t('auth.logout.submitting') : t('auth.logout.submit')}
              </button>
            </div>
          </div>
        </aside>

        <section className="flex flex-col flex-1 min-w-0 min-h-0 bg-slate-50 relative">
          <header className="relative z-20 flex flex-shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">
                {t('setup.shell.phase')}
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {setup.state?.school.name ?? t('setup.shell.loadingSchool')}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={t('setup.shell.database')} tone="green" />
              <StatusPill
                label={
                  apiBaseUrl && desktopStatus?.sidecarStatus !== 'failed'
                    ? t('auth.serviceStatus.ready')
                    : t('auth.serviceStatus.unavailable')
                }
                tone={apiBaseUrl ? 'green' : 'red'}
              />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4 lg:p-5">
            {setup.isLoading ? <SetupSkeleton /> : null}

            {!setup.isLoading && !setup.state ? (
              <div className="rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
                <p className="text-sm font-bold text-red-700">
                  {setup.errorKey ? t(setup.errorKey) : t('setup.errors.generic')}
                </p>
                <button
                  className="mt-5 h-11 cursor-pointer rounded-xl bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
                  onClick={() => {
                    void setup.reload();
                  }}
                  type="button"
                >
                  {t('setup.actions.retry')}
                </button>
              </div>
            ) : null}

            {setup.state?.school.setupStatus !== undefined &&
            setup.state.school.setupStatus !== 'COMPLETED' ? (
              <SetupWizard
                activeStep={activeStep ?? setup.state.nextStep}
                errorKey={setup.errorKey}
                isSaving={setup.isSaving}
                onComplete={setup.complete}
                onSaveCalendar={setup.saveCalendar}
                onSaveClassLevels={setup.saveClassLevels}
                onSaveProfile={setup.saveProfile}
                setActiveStep={setActiveStep}
                state={setup.state}
              />
            ) : null}

            {setup.state?.school.setupStatus === 'COMPLETED' ? (
              <SetupCompleteDashboard state={setup.state} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function SetupCompleteDashboard({ state }: { state: SetupStateResponse }) {
  const { t } = useTranslation();
  const currentTerm = state.terms.find((term) => term.isCurrent);

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[1fr_360px]">
      <div className="rounded-3xl border border-white bg-white p-7 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">
          {t('setup.complete.eyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          {t('setup.complete.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-500">
          {t('setup.complete.body')}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <DashboardMetric
            label={t('setup.review.academicYear')}
            value={state.academicYear?.label ?? '-'}
          />
          <DashboardMetric
            label={t('setup.review.currentTerm')}
            value={currentTerm?.label ?? '-'}
          />
          <DashboardMetric
            label={t('setup.review.classLevels')}
            value={String(state.classLevels.length)}
          />
          <DashboardMetric label={t('setup.review.city')} value={state.school.city ?? '-'} />
        </div>
      </div>

      <aside className="rounded-3xl border border-white bg-slate-950 p-6 text-white shadow-sm">
        <p className="text-sm font-black">{t('setup.complete.enabledModules')}</p>
        <div className="mt-4 space-y-3">
          {state.enabledModules.map((moduleConfig) => (
            <div
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold"
              key={moduleConfig.id}
            >
              {t(`setup.modules.${moduleConfig.moduleName}`)}
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'red' }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold shadow-sm ${
        tone === 'green'
          ? 'border-teal-200/50 bg-teal-50 text-teal-800'
          : 'border-red-200/50 bg-red-50 text-red-700'
      }`}
    >
      {tone === 'green' ? (
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-20"></span>
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-teal-400/50"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></span>
        </span>
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
        </span>
      )}
      {label}
    </span>
  );
}

function SetupSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse rounded-3xl border border-white bg-white p-8 shadow-sm">
      <div className="h-5 w-32 rounded bg-slate-100" />
      <div className="mt-4 h-9 w-80 rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function resolveVisibleModules(modules: SchoolModuleName[] | undefined): SchoolModuleName[] {
  return modules && modules.length > 0 ? modules : ['SCHOOL_SETUP'];
}
