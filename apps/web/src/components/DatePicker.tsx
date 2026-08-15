import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatISODate } from './dateFormat';

export function DatePicker({ onChange, value }: { onChange: (v: string) => void; value: string }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [popPosition, setPopPosition] = useState<'top' | 'bottom'>('bottom');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayValue = formatISODate(value);

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
    onChange(`${String(currentYear)}-${m}-${d}`);
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
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        type="button"
      >
        <span>
          {displayValue || (
            <span className="font-medium text-slate-400">{t('common.date.placeholder')}</span>
          )}
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
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
              aria-label={t('common.datePicker.previousMonth')}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              onClick={prevMonth}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M15 19l-7-7 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
            <span className="text-sm font-bold text-slate-900">
              {t(`common.date.months.${String(currentMonth)}`)} {currentYear}
            </span>
            <button
              aria-label={t('common.datePicker.nextMonth')}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              onClick={nextMonth}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center text-xs font-bold text-slate-400">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i}>{t(`common.date.weekdaysShort.${String(i)}`)}</div>
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
