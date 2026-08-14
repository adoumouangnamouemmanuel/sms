import type { SetupStateResponse } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { WizardPrimaryButton } from './SetupProfileStep';

export interface SetupReviewStepProps {
  isSaving: boolean;
  onSubmit: () => void;
  state: SetupStateResponse;
}

export function SetupReviewStep({ isSaving, onSubmit, state }: SetupReviewStepProps) {
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
                  className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800"
                  key={moduleConfig.id}
                >
                  {t(`setup.modules.${moduleConfig.moduleName}`)}
                </span>
              ))
            : ['SCHOOL_SETUP', 'ACADEMIC_STRUCTURE'].map((moduleName) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600"
                  key={moduleName}
                >
                  {t(`setup.modules.${moduleName}`)}
                </span>
              ))}
        </div>
      </div>

      <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.complete')} />
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
