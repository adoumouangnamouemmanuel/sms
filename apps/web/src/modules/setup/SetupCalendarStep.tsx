import type { SetupCalendarRequest, TermSystem } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { createSuggestedTerms } from './setupSteps';
import { WizardPrimaryButton } from './SetupProfileStep';

export interface SetupCalendarStepProps {
  draft: SetupCalendarRequest;
  isSaving: boolean;
  onChange: (draft: SetupCalendarRequest) => void;
  onSubmit: () => void;
}

export function SetupCalendarStep({ draft, isSaving, onChange, onSubmit }: SetupCalendarStepProps) {
  const { t } = useTranslation();

  function updateYear(field: keyof SetupCalendarRequest['academicYear'], value: string) {
    const academicYear = { ...draft.academicYear, [field]: value };

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

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
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
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            key={term.termNumber}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-900">
                {t('setup.calendar.period')} {term.termNumber}
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-teal-700">
                <input
                  checked={term.isCurrent}
                  className="h-4 w-4 cursor-pointer accent-teal-700"
                  name="current-term"
                  onChange={() => {
                    onChange({
                      ...draft,
                      terms: draft.terms.map((item, itemIndex) => ({
                        ...item,
                        isCurrent: itemIndex === index,
                      })),
                    });
                  }}
                  type="radio"
                />
                {t('setup.calendar.current')}
              </label>
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

      <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
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
      <input
        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
