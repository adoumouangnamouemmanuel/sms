import type { SetupClassLevelInput } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { WizardPrimaryButton } from './SetupProfileStep';

export interface SetupClassLevelsStepProps {
  draft: SetupClassLevelInput[];
  isSaving: boolean;
  onChange: (draft: SetupClassLevelInput[]) => void;
  onSubmit: () => void;
}

export function SetupClassLevelsStep({
  draft,
  isSaving,
  onChange,
  onSubmit,
}: SetupClassLevelsStepProps) {
  const { t } = useTranslation();

  function updateText(index: number, field: 'code' | 'name', value: string) {
    onChange(
      draft.map((level, levelIndex) =>
        levelIndex === index ? { ...level, [field]: value } : level
      )
    );
  }

  function updateOrder(index: number, displayOrder: number) {
    onChange(
      draft.map((level, levelIndex) => (levelIndex === index ? { ...level, displayOrder } : level))
    );
  }

  function updateExamYear(index: number, isExamYear: boolean) {
    onChange(
      draft.map((level, levelIndex) => (levelIndex === index ? { ...level, isExamYear } : level))
    );
  }

  function removeLevel(index: number) {
    onChange(
      draft
        .filter((_level, levelIndex) => levelIndex !== index)
        .map((level, levelIndex) => ({ ...level, displayOrder: levelIndex + 1 }))
    );
  }

  function addLevel() {
    onChange([
      ...draft,
      {
        code: '',
        name: '',
        displayOrder: draft.length + 1,
        isExamYear: false,
      },
    ]);
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[72px_1fr_1fr_120px_56px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
          <span>{t('setup.classLevels.order')}</span>
          <span>{t('setup.classLevels.code')}</span>
          <span>{t('setup.classLevels.name')}</span>
          <span>{t('setup.classLevels.examYear')}</span>
          <span aria-hidden="true" />
        </div>

        <div className="divide-y divide-slate-100">
          {draft.map((level, index) => (
            <div
              className="grid grid-cols-[72px_1fr_1fr_120px_56px] items-center gap-3 px-4 py-3"
              key={`${level.code}-${String(index)}`}
            >
              <input
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
                min={1}
                onChange={(event) => {
                  updateOrder(index, Number(event.target.value));
                }}
                required
                type="number"
                value={level.displayOrder}
              />
              <input
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold uppercase text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
                onChange={(event) => {
                  updateText(index, 'code', event.target.value);
                }}
                required
                value={level.code}
              />
              <input
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
                onChange={(event) => {
                  updateText(index, 'name', event.target.value);
                }}
                required
                value={level.name}
              />
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  checked={level.isExamYear}
                  className="h-4 w-4 cursor-pointer accent-teal-700"
                  onChange={(event) => {
                    updateExamYear(index, event.target.checked);
                  }}
                  type="checkbox"
                />
                {t('setup.classLevels.yes')}
              </label>
              <button
                aria-label={t('setup.classLevels.remove')}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={draft.length === 1}
                onClick={() => {
                  removeLevel(index);
                }}
                type="button"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  -
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          onClick={addLevel}
          type="button"
        >
          {t('setup.classLevels.add')}
        </button>
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
      </div>
    </form>
  );
}
