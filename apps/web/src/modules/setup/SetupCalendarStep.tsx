import type { SetupCalendarRequest, TermSystem } from '@edutrack/shared';
import { useEffect, useRef, useState } from 'react';
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
      className="space-y-4"
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
                      <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
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
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
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
        <SetupDatePicker onChange={onChange} value={value} />
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

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

function SetupDatePicker({ onChange, value }: { onChange: (v: string) => void; value: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [popPosition, setPopPosition] = useState<'top' | 'bottom'>('bottom');
  const popoverRef = useRef<HTMLDivElement>(null);

  const parsedDate = value ? new Date(`${value}T12:00:00Z`) : new Date();
  const [currentMonth, setCurrentMonth] = useState(parsedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(parsedDate.getFullYear());

  useEffect(() => {
    if (isOpen && popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 320 && rect.top > spaceBelow) {
        setPopPosition('top');
      } else {
        setPopPosition('bottom');
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displayValue = value ? value.split('-').reverse().join('/') : '';

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handleDateClick = (day: number) => {
    const d = String(day).padStart(2, '0');
    const m = String(currentMonth + 1).padStart(2, '0');
    onChange(`${currentYear}-${m}-${d}`);
    setIsOpen(false);
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  return (
    <div className="relative flex w-full flex-col" ref={popoverRef}>
      <button
        className="flex h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        type="button"
      >
        <span>
          {displayValue || <span className="font-medium text-slate-400">JJ/MM/AAAA</span>}
        </span>
        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </button>

      {isOpen ? (
        <div
          className={`absolute z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ${
            popPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              onClick={prevMonth}
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
            <span className="text-sm font-bold text-slate-900">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <button
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              onClick={nextMonth}
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center text-xs font-bold text-slate-400">
            {DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${String(i)}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${String(currentYear)}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === dateStr;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <button
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[13px] transition-all ${
                    isSelected
                      ? 'bg-teal-600 font-bold text-white shadow-md'
                      : isToday
                        ? 'bg-teal-50 font-bold text-teal-700 hover:bg-teal-100'
                        : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  key={day}
                  onClick={() => {
                    handleDateClick(day);
                  }}
                  type="button"
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
