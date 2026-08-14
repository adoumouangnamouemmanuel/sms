import type {
  SetupCalendarRequest,
  SetupClassLevelInput,
  SetupSchoolProfileRequest,
  SetupStateResponse,
  SetupStepId,
} from '@edutrack/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SetupCalendarStep } from './SetupCalendarStep';
import { SetupClassLevelsStep } from './SetupClassLevelsStep';
import { SetupProfileStep } from './SetupProfileStep';
import { SetupReviewStep } from './SetupReviewStep';
import {
  createCalendarDraft,
  createClassLevelsDraft,
  createProfileDraft,
  setupStepOrder,
} from './setupSteps';

export interface SetupWizardProps {
  errorKey: string | null;
  isSaving: boolean;
  onComplete: () => Promise<SetupStateResponse | null>;
  onSaveCalendar: (input: SetupCalendarRequest) => Promise<SetupStateResponse | null>;
  onSaveClassLevels: (input: {
    classLevels: SetupClassLevelInput[];
  }) => Promise<SetupStateResponse | null>;
  onSaveProfile: (input: SetupSchoolProfileRequest) => Promise<SetupStateResponse | null>;
  state: SetupStateResponse;
  activeStep: SetupStepId;
  setActiveStep: (step: SetupStepId) => void;
}

export function SetupWizard({
  errorKey,
  isSaving,
  onComplete,
  onSaveCalendar,
  onSaveClassLevels,
  onSaveProfile,
  state,
  activeStep,
  setActiveStep,
}: SetupWizardProps) {
  const { t } = useTranslation();
  const [profileDraft, setProfileDraft] = useState(() => createProfileDraft(state));
  const [calendarDraft, setCalendarDraft] = useState(() => createCalendarDraft(state));
  const [classLevelDraft, setClassLevelDraft] = useState(() => createClassLevelsDraft(state));
  const activeStepIndex = setupStepOrder.indexOf(activeStep);
  const completionPercent = useMemo(
    () => Math.round(((activeStepIndex + 1) / setupStepOrder.length) * 100),
    [activeStepIndex]
  );

  async function saveProfile() {
    const nextState = await onSaveProfile(profileDraft);

    if (nextState) {
      setActiveStep('calendar');
    }
  }

  async function saveCalendar() {
    const nextState = await onSaveCalendar(calendarDraft);

    if (nextState) {
      setActiveStep('classLevels');
    }
  }

  async function saveClassLevels() {
    const nextState = await onSaveClassLevels({ classLevels: classLevelDraft });

    if (nextState) {
      setActiveStep('review');
    }
  }

  const stepContent = {
    profile: (
      <SetupProfileStep
        draft={profileDraft}
        isSaving={isSaving}
        onChange={(field, value) => {
          setProfileDraft((current) => ({ ...current, [field]: value }));
        }}
        onSubmit={() => {
          void saveProfile();
        }}
      />
    ),
    calendar: (
      <SetupCalendarStep
        draft={calendarDraft}
        isSaving={isSaving}
        onChange={setCalendarDraft}
        onSubmit={() => {
          void saveCalendar();
        }}
      />
    ),
    classLevels: (
      <SetupClassLevelsStep
        draft={classLevelDraft}
        isSaving={isSaving}
        onChange={setClassLevelDraft}
        onSubmit={() => {
          void saveClassLevels();
        }}
      />
    ),
    review: (
      <SetupReviewStep
        isSaving={isSaving}
        onSubmit={() => {
          void onComplete();
        }}
        state={state}
      />
    ),
  } satisfies Record<SetupStepId, ReactNode>;

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex-1 overflow-y-auto">
          <div className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-5 lg:px-7 lg:pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                  <svg
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      clipRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      fillRule="evenodd"
                    />
                  </svg>
                  {t('setup.subtitle')}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950 lg:text-3xl">
                  {t('setup.title')}
                </h2>
              </div>
              <div className="w-full max-w-sm">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>
                    {t('setup.progress')} -{' '}
                    {t('setup.progressStep', {
                      current: activeStepIndex + 1,
                      total: setupStepOrder.length,
                    })}
                  </span>
                  <span className="text-slate-900">{String(completionPercent)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/60 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${String(completionPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-5 lg:p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col pb-2">
              <div className="mb-5">
                <h3 className="text-xl font-black text-slate-950">
                  {t(`setup.steps.${activeStep}.title`)}
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {t(`setup.steps.${activeStep}.body`)}
                </p>
              </div>

              {errorKey ? (
                <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {t(errorKey)}
                </div>
              ) : null}

              {stepContent[activeStep]}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-3xl bg-gradient-to-t from-white to-transparent" />
      </div>
    </section>
  );
}
