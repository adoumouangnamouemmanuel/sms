import type { SetupStateResponse } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupReviewStepProps {
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  state: SetupStateResponse;
}

export function SetupReviewStep({ isSaving, onBack, onSubmit, state }: SetupReviewStepProps) {
  const { t } = useTranslation();
  const currentTerm = state.terms.find((term) => term.isCurrent);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryTile label={t('setup.review.school')} value={state.school.name} />
        <SummaryTile
          label={t('setup.review.academicYear')}
          value={state.academicYear?.label ?? '-'}
        />
        <SummaryTile label={t('setup.review.currentTerm')} value={currentTerm?.label ?? '-'} />
        <SummaryTile label={t('setup.review.city')} value={state.school.city ?? '-'} />
        <SummaryTile
          label={t('setup.review.classLevels')}
          value={String(state.classLevels.length)}
        />
        <SummaryTile
          label={t('setup.review.termSystem')}
          value={state.termSystem ? t(`setup.calendar.systems.${state.termSystem}`) : '-'}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-black text-slate-900">{t('setup.review.modulesTitle')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.enabledModules.length > 0
            ? state.enabledModules.map((moduleConfig) => (
                <span
                  className="flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800"
                  key={moduleConfig.id}
                >
                  {MODULE_ICONS[moduleConfig.moduleName] || null}
                  {t(`setup.modules.${moduleConfig.moduleName}`)}
                </span>
              ))
            : ['SCHOOL_SETUP', 'ACADEMIC_STRUCTURE'].map((moduleName) => (
                <span
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600"
                  key={moduleName}
                >
                  {MODULE_ICONS[moduleName] || null}
                  {t(`setup.modules.${moduleName}`)}
                </span>
              ))}
        </div>
      </div>

      <div className="flex gap-4 pt-1">
        <WizardSecondaryButton label={t('setup.actions.back')} onClick={onBack} />
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.complete')} />
      </div>
    </form>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AcademicIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  SCHOOL_SETUP: <GearIcon />,
  ACADEMIC_STRUCTURE: <AcademicIcon />,
};
