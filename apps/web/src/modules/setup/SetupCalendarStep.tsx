import type { SetupCalendarRequest, TermSystem } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { createSuggestedTerms } from './setupSteps';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupCalendarStepProps {
  draft: SetupCalendarRequest;
  isSaving: boolean;
  onBack: () => void;
  onChange: (draft: SetupCalendarRequest) => void;
  onSubmit: () => void;
}

export function SetupCalendarStep({
  draft,
  isSaving,
  onBack,
  onChange,
  onSubmit,
}: SetupCalendarStepProps) {
  const { t } = useTranslation();

  function updateYear(field: keyof SetupCalendarRequest['academicYear'], value: string) {
    const academicYear = { ...draft.academicYear, [field]: value };

    if (field === 'label') {
      onChange({ ...draft, academicYear });
      return;
    }

    onChange({
      ...draft,
      academicYear,
      terms: createSuggestedTerms(draft.termSystem, academicYear.startDate, academicYear.endDate),
    });
  }

  function updateTermSystem(termSystem: TermSystem) {
    onChange({
      ...draft,
      termSystem,
      terms: createSuggestedTerms(
        termSystem,
        draft.academicYear.startDate,
        draft.academicYear.endDate
      ),
    });
  }

  function updateTermText(index: number, field: 'endDate' | 'label' | 'startDate', value: string) {
    onChange({
      ...draft,
      terms: draft.terms.map((term, termIndex) =>
        termIndex === index ? { ...term, [field]: value } : term
      ),
    });
  }

  const hasEmptyDate =
    !draft.academicYear.startDate ||
    !draft.academicYear.endDate ||
    draft.terms.some((term) => !term.startDate || !term.endDate);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (hasEmptyDate) return;
        onSubmit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <CalendarField
          label={t('setup.calendar.label')}
          onChange={(value) => {
            updateYear('label', value);
          }}
          value={draft.academicYear.label}
        />
        <CalendarField
          label={t('setup.calendar.startDate')}
          onChange={(value) => {
            updateYear('startDate', value);
          }}
          type="date"
          value={draft.academicYear.startDate}
        />
        <CalendarField
          label={t('setup.calendar.endDate')}
          onChange={(value) => {
            updateYear('endDate', value);
          }}
          type="date"
          value={draft.academicYear.endDate}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-800">
          {t('setup.calendar.termSystem')}
        </p>
        <div className="inline-grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {(['TRIMESTER', 'SEMESTER'] as const).map((termSystem) => (
            <button
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition ${
                draft.termSystem === termSystem
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              key={termSystem}
              onClick={() => {
                updateTermSystem(termSystem);
              }}
              type="button"
            >
              {t(`setup.calendar.systems.${termSystem}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {draft.terms.map((term, index) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            key={term.termNumber}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-900">
                {t('setup.calendar.period')} {term.termNumber}
              </p>
              <button
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${term.isCurrent ? 'bg-teal-100 text-teal-800' : 'border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-900'}`}
                onClick={() => {
                  onChange({
                    ...draft,
                    terms: draft.terms.map((item, itemIndex) => ({
                      ...item,
                      isCurrent: itemIndex === index,
                    })),
                  });
                }}
                type="button"
              >
                {term.isCurrent ? (
                  <>
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clipRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fillRule="evenodd"
                      />
                    </svg>
                    {t('setup.calendar.current')}
                  </>
                ) : (
                  t('setup.calendar.setCurrent')
                )}
              </button>
            </div>
            <div className="space-y-3">
              <CalendarField
                label={t('setup.calendar.periodLabel')}
                onChange={(value) => {
                  updateTermText(index, 'label', value);
                }}
                value={term.label}
              />
              <CalendarField
                label={t('setup.calendar.startDate')}
                onChange={(value) => {
                  updateTermText(index, 'startDate', value);
                }}
                type="date"
                value={term.startDate}
              />
              <CalendarField
                label={t('setup.calendar.endDate')}
                onChange={(value) => {
                  updateTermText(index, 'endDate', value);
                }}
                type="date"
                value={term.endDate}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 pt-1">
        <WizardSecondaryButton label={t('setup.actions.back')} onClick={onBack} />
        <WizardPrimaryButton
          disabled={hasEmptyDate}
          isSaving={isSaving}
          label={t('setup.actions.saveAndContinue')}
        />
      </div>
    </form>
  );
}

interface CalendarFieldProps {
  label: string;
  onChange: (value: string) => void;
  type?: 'date' | 'text';
  value: string;
}

function CalendarField({ label, onChange, type = 'text', value }: CalendarFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {type === 'date' ? (
        <input
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          required
          type="date"
          value={value}
        />
      ) : (
        <input
          className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          required
          type="text"
          value={value}
        />
      )}
    </label>
  );
}
