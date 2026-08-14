import {
  APP_NAME,
  type PublicAuthUser,
  type SetupStateResponse,
  type SetupStepId,
} from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { type LogoutClient } from '../auth';
import type { DesktopDeploymentStatus } from '../../desktopStatus';
import { MainAppShell } from '../app';
import { SetupWizard } from './SetupWizard';
import { useSetupState, type SetupClient } from './useSetupState';
import { setupStepOrder } from './setupSteps';

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


  const [activeStep, setActiveStep] = useState<SetupStepId | null>(null);
  const [isInMainApp, setIsInMainApp] = useState(false);
  const currentStep = activeStep ?? setup.state?.nextStep ?? null;
  const isCompleted = setup.state?.school.setupStatus === 'COMPLETED';
  const activeStepIndex = currentStep ? setupStepOrder.indexOf(currentStep) : 0;

  // Once setup is complete the user can switch to the main app shell.
  if (isInMainApp && setup.state) {
    return (
      <MainAppShell
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken ? { capabilityToken } : {})}
        {...(desktopStatus !== undefined ? { desktopStatus } : {})}
        {...(logoutClient ? { logoutClient } : {})}
        onLoggedOut={onLoggedOut}
        setupState={setup.state}
        user={user}
      />
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-950">
      {/* Minimal Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-base font-black text-white shadow-sm">
              E
            </div>
            <div>
              <p className="text-[15px] font-black leading-tight tracking-tight text-slate-950">
                {APP_NAME}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {t('setup.shell.local')}
              </p>
            </div>
          </div>

          {/* Progress Indicator (only if not completed and state exists) */}
          {!isCompleted && setup.state && currentStep ? (
            <div className="flex flex-col gap-1.5 md:items-end">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t('setup.progressStep', {
                  current: activeStepIndex + 1,
                  total: setupStepOrder.length,
                })}
                <span className="mx-2 text-slate-300">•</span>
                <span className="text-slate-900">{t(`setup.steps.${currentStep}.title`)}</span>
              </div>
              <div className="flex gap-1.5">
                {setupStepOrder.map((step, idx) => (
                  <div
                    className={`h-1.5 w-8 rounded-full transition-colors ${
                      idx <= activeStepIndex ? 'bg-teal-500' : 'bg-slate-200'
                    }`}
                    key={step}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main Content Area */}
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className={`mx-auto flex w-full max-w-4xl flex-col ${isCompleted ? 'my-auto' : ''}`}>
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

          {!isCompleted && setup.state ? (
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

          {isCompleted && setup.state ? (
            <SetupCompleteDashboard
              onEnterApp={() => {
                setIsInMainApp(true);
              }}
              state={setup.state}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SetupCompleteDashboard({
  onEnterApp,
  state,
}: {
  onEnterApp: () => void;
  state: SetupStateResponse;
}) {
  const { t } = useTranslation();
  const currentTerm = state.terms.find((term) => term.isCurrent);
  const enabledModuleLabels = state.enabledModules
    .map((m) => t(`setup.modules.${m.moduleName}`))
    .join(' et ');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
      <div
        className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-teal-600 shadow-sm ring-8 ring-teal-50 transition-all duration-700 ease-out ${
          mounted ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}
      >
        <svg
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          viewBox="0 0 24 24"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">
        {t('setup.complete.eyebrow')}
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
        {t('setup.complete.title')}
      </h2>
      <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">
        {t('setup.complete.body')}
      </p>

      <div className="mt-12 flex w-full flex-wrap justify-center gap-x-12 gap-y-8">
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

      <div className="mt-20 flex w-full sm:-mx-8 sm:w-[calc(100%+4rem)] flex-col items-center gap-6 rounded-[2rem] bg-teal-50/50 p-8 sm:p-10 shadow-sm ring-1 ring-teal-500/10">
        <p className="text-sm font-bold text-slate-600">
          {enabledModuleLabels} sont maintenant disponibles.
        </p>
        <button
          className="inline-flex items-center gap-3 rounded-2xl bg-teal-600 px-8 py-4 text-base font-black text-white shadow-md shadow-teal-900/20 transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 active:scale-[0.98]"
          id="enter-app-btn"
          onClick={onEnterApp}
          type="button"
        >
          {t('setup.complete.enterApp')}
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1.5 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="mx-auto w-full animate-pulse rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
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


