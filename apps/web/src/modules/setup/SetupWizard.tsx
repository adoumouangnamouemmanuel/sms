import type {
  AdvanceSetupStepRequest,
  SetupCalendarRequest,
  SetupClassLevelInput,
  SetupSchoolProfileRequest,
  SetupStateResponse,
  SetupStepId,
} from '@edutrack/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SetupAppreciationStep } from './SetupAppreciationStep';
import { SetupCalendarStep } from './SetupCalendarStep';
import { SetupClassLevelsStep } from './SetupClassLevelsStep';
import { SetupGradingStep } from './SetupGradingStep';
import { SetupGroupsStep } from './SetupGroupsStep';
import { SetupProfileStep } from './SetupProfileStep';
import { SetupReviewStep } from './SetupReviewStep';
import { SetupSubjectsStep } from './SetupSubjectsStep';
import { createCalendarDraft, createClassLevelsDraft, createProfileDraft } from './setupSteps';

export interface SetupWizardProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  errorKey: string | null;
  isSaving: boolean;
  onAdvanceStep: (input: AdvanceSetupStepRequest) => Promise<SetupStateResponse | null>;
  onComplete: () => Promise<SetupStateResponse | null>;
  onSaveCalendar: (input: SetupCalendarRequest) => Promise<SetupStateResponse | null>;
  onSaveClassLevels: (input: {
    classLevels: SetupClassLevelInput[];
  }) => Promise<SetupStateResponse | null>;
  onSaveProfile: (input: SetupSchoolProfileRequest) => Promise<SetupStateResponse | null>;
  onSessionExpired?: () => void;
  state: SetupStateResponse;
  activeStep: SetupStepId;
  setActiveStep: (step: SetupStepId) => void;
}

export function SetupWizard({
  apiBaseUrl,
  capabilityToken,
  errorKey,
  isSaving,
  onAdvanceStep,
  onComplete,
  onSaveCalendar,
  onSaveClassLevels,
  onSaveProfile,
  onSessionExpired,
  state,
  activeStep,
  setActiveStep,
}: SetupWizardProps) {
  const { t } = useTranslation();
  const [profileDraft, setProfileDraft] = useState(() => createProfileDraft(state));
  const [calendarDraft, setCalendarDraft] = useState(() => createCalendarDraft(state));
  const [classLevelDraft, setClassLevelDraft] = useState(() => createClassLevelsDraft(state));

  async function saveProfile() {
    const nextState = await onSaveProfile(profileDraft);

    if (nextState) {
      setActiveStep(nextState.nextStep);
    }
  }

  async function saveCalendar() {
    const nextState = await onSaveCalendar(calendarDraft);

    if (nextState) {
      setActiveStep(nextState.nextStep);
    }
  }

  async function saveClassLevels() {
    const nextState = await onSaveClassLevels({ classLevels: classLevelDraft });

    if (nextState) {
      setActiveStep(nextState.nextStep);
    }
  }

  async function advanceModuleStep(step: AdvanceSetupStepRequest['step']) {
    const nextState = await onAdvanceStep({ step });

    if (nextState) {
      setActiveStep(nextState.nextStep);
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
        onBack={() => {
          setActiveStep('profile');
        }}
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
        onBack={() => {
          setActiveStep('calendar');
        }}
        onChange={setClassLevelDraft}
        onSubmit={() => {
          void saveClassLevels();
        }}
      />
    ),
    subjects: (
      <SetupSubjectsStep
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        isSaving={isSaving}
        onBack={() => {
          setActiveStep('classLevels');
        }}
        onSubmit={() => {
          void advanceModuleStep('subjects');
        }}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />
    ),
    groups: (
      <SetupGroupsStep
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        isSaving={isSaving}
        onBack={() => {
          setActiveStep('subjects');
        }}
        onSubmit={() => {
          void advanceModuleStep('groups');
        }}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />
    ),
    grading: (
      <SetupGradingStep
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        isSaving={isSaving}
        onBack={() => {
          setActiveStep('groups');
        }}
        onSubmit={() => {
          void advanceModuleStep('grading');
        }}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />
    ),
    appreciation: (
      <SetupAppreciationStep
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        isSaving={isSaving}
        onBack={() => {
          setActiveStep('grading');
        }}
        onSubmit={() => {
          void advanceModuleStep('appreciation');
        }}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />
    ),
    review: (
      <SetupReviewStep
        isSaving={isSaving}
        onBack={() => {
          setActiveStep('appreciation');
        }}
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
          <div className="flex min-h-0 flex-col p-5 lg:p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-2">
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
