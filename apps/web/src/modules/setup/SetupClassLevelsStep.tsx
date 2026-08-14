import type { SetupClassLevelInput } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupClassLevelsStepProps {
  draft: SetupClassLevelInput[];
  isSaving: boolean;
  onBack: () => void;
  onChange: (draft: SetupClassLevelInput[]) => void;
  onSubmit: () => void;
}

export function SetupClassLevelsStep({
  draft,
  isSaving,
  onBack,
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
        <div className="grid grid-cols-[72px_1fr_1.5fr_120px_56px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
          <span>{t('setup.classLevels.order')}</span>
          <span>{t('setup.classLevels.code')}</span>
          <span>{t('setup.classLevels.name')}</span>
          <span>{t('setup.classLevels.examYear')}</span>
          <span aria-hidden="true" />
        </div>

        <div className="divide-y divide-slate-100">
          {draft.map((level, index) => (
            <div
              className="grid grid-cols-[72px_1fr_1.5fr_120px_56px] items-center gap-3 px-4 py-1.5"
              key={`class-level-${String(index)}`}
            >
              <input
                className="h-10 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-bold text-slate-900 outline-none transition-all hover:bg-slate-50 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
                min={1}
                onChange={(event) => {
                  updateOrder(index, Number(event.target.value));
                }}
                required
                type="number"
                value={level.displayOrder}
              />
              <input
                className="h-10 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-bold uppercase text-slate-900 outline-none transition-all hover:bg-slate-50 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
                onChange={(event) => {
                  updateText(index, 'code', event.target.value);
                }}
                required
                value={level.code}
              />
              <input
                className="h-10 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-semibold text-slate-900 outline-none transition-all hover:bg-slate-50 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
                onChange={(event) => {
                  updateText(index, 'name', event.target.value);
                }}
                required
                value={level.name}
              />
              <div className="flex items-center px-2">
                <button
                  aria-checked={level.isExamYear}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${level.isExamYear ? 'bg-teal-600' : 'bg-slate-200'}`}
                  onClick={() => {
                    updateExamYear(index, !level.isExamYear);
                  }}
                  role="switch"
                  type="button"
                >
                  <span className="sr-only">{t('setup.classLevels.examYear')}</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 transform rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 transition duration-200 ease-in-out ${level.isExamYear ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-end">
                <button
                  aria-label={t('setup.classLevels.remove')}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={draft.length === 1}
                  onClick={() => {
                    removeLevel(index);
                  }}
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 bg-slate-50/50 p-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-[13px] font-bold text-slate-500 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
            onClick={addLevel}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 4v16m8-8H4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
              />
            </svg>
            {t('setup.classLevels.add')}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <WizardSecondaryButton label={t('setup.actions.back')} onClick={onBack} />
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
      </div>
    </form>
  );
}
