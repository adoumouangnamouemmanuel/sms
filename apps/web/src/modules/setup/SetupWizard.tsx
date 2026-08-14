import type {
  SetupCalendarRequest,
  SetupClassLevelInput,
  SetupSchoolProfileRequest,
  SetupStateResponse,
  SetupStepId,
} from '@edutrack/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SetupCalendarStep } from './SetupCalendarStep';
import { SetupClassLevelsStep } from './SetupClassLevelsStep';
import { SetupProfileStep } from './SetupProfileStep';
import { SetupReviewStep } from './SetupReviewStep';
import { createCalendarDraft, createClassLevelsDraft, createProfileDraft } from './setupSteps';

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
    review: (
      <SetupReviewStep
        isSaving={isSaving}
        onBack={() => {
          setActiveStep('classLevels');
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
