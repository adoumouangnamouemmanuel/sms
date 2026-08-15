import type { RecordStatus, PersonSex } from '@edutrack/shared';
import { useEffect, useId, useRef, useState } from 'react';

export const formInputClassName =
  'h-[50px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10';
export const formSelectClassName =
  'h-[50px] w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10';

// ---------------------------------------------------------------------------
// Modal building blocks
// ---------------------------------------------------------------------------

const MIN_MODAL_WIDTH = 480;
const MAX_MODAL_WIDTH = 1200;
const MIN_MODAL_HEIGHT = 320;
const MAX_MODAL_HEIGHT = 900;

function clampResize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ModalShell({
  title,
  closeLabel,
  resizeLabel,
  onClose,
  resizable = false,
  size = 'md',
  children,
}: {
  title: string;
  closeLabel: string;
  resizeLabel?: string;
  onClose: () => void;
  /**
   * When true, a bottom-right drag handle lets the user resize the dialog
   * (used by content-heavy steps such as the import preview table).
   */
  resizable?: boolean;
  /** 'lg' is for content-heavy steps (e.g. the import preview table). */
  size?: 'md' | 'lg';
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setDims({
      width: clampResize(start.width + (event.clientX - start.x), MIN_MODAL_WIDTH, MAX_MODAL_WIDTH),
      height: clampResize(
        start.height + (event.clientY - start.y),
        MIN_MODAL_HEIGHT,
        MAX_MODAL_HEIGHT
      ),
    });
  };

  const endResize = () => {
    dragStartRef.current = null;
  };

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
    >
      <div
        className="relative"
        ref={panelRef}
        style={
          dims
            ? { width: dims.width, maxWidth: '90vw', height: dims.height, maxHeight: '90vh' }
            : undefined
        }
      >
        <div
          className={`flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-3xl border border-white bg-white p-6 shadow-2xl ${
            dims ? '' : size === 'lg' ? 'max-w-4xl' : 'max-w-md'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-950" id={titleId}>
              {title}
            </h2>
            <button
              aria-label={closeLabel}
              className="cursor-pointer rounded-lg px-2 py-1 text-[13px] font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
          {children}
        </div>

        {resizable && (
          <div
            aria-label={resizeLabel ?? closeLabel}
            className="absolute -bottom-2 -right-2 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end rounded-bl-xl rounded-tr-xl bg-teal-500/90 p-1 shadow-lg ring-1 ring-teal-600/30 hover:bg-teal-500"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            role="separator"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path d="M4 20 20 4" />
              <path d="M13 20h7v-7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalCancelButton({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-500 hover:bg-slate-50"
      onClick={onClose}
      type="button"
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function FormField({
  defaultValue,
  label,
  name,
  type = 'text',
  required = false,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-slate-800">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        className={formInputClassName}
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

export function SelectField({
  defaultValue,
  label,
  name,
  options,
  placeholderOption = '-',
}: {
  defaultValue?: string;
  label: string;
  name: string;
  options: { label: string; value: string }[];
  placeholderOption?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-slate-800">{label}</span>
      <select className={formSelectClassName} defaultValue={defaultValue} name={name}>
        <option value="">{placeholderOption}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// List building blocks
// ---------------------------------------------------------------------------

export interface ListToolbarLabels {
  count: string;
  new: string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  filter: string;
  status: string;
  statusActive: string;
  statusArchived: string;
  /** Optional import action shown next to the create button (Phase 3.4). */
  import?: string;
  /** Optional class-level/classroom filter labels (students list, Phase 4). */
  classLevel?: string;
  classroom?: string;
  allLevels?: string;
  allClassrooms?: string;
  sex?: string;
  sexMale?: string;
  sexFemale?: string;
  allSexes?: string;
}

export interface ClassFilterOption {
  id: string;
  label: string;
}

/**
 * Shared list toolbar: result count, live search with an explicit clear
 * control, a "Filtres" panel (status for now), and the create action in a
 * separate zone behind a divider.
 */
export function ListToolbar({
  classLevelId,
  classroomId,
  classLevels,
  classrooms,
  labels,
  onClassLevelChange,
  onClassroomChange,
  onImport,
  onNew,
  onSearch,
  onSearchValueChange,
  onStatusChange,
  onSexChange,
  searchValue,
  sex,
  status,
}: {
  /** Optional ACTIVE-enrollment class filters (students list, Phase 4). */
  classLevelId?: string | null;
  classroomId?: string | null;
  classLevels?: ClassFilterOption[];
  classrooms?: ClassFilterOption[];
  onClassLevelChange?: (classLevelId: string | null) => void;
  onClassroomChange?: (classroomId: string | null) => void;
  labels: ListToolbarLabels;
  onImport?: () => void;
  onNew: () => void;
  onSearch: (search: string) => void;
  onSearchValueChange: (value: string) => void;
  onStatusChange: (status: RecordStatus) => void;
  onSexChange?: (sex: PersonSex | null) => void;
  searchValue: string;
  sex?: PersonSex | null;
  status: RecordStatus;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto flex-1">
        <p className="text-[13px] font-bold text-slate-500 whitespace-nowrap">{labels.count}</p>

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(searchValue);
          }}
        >
          <div className="relative">
            <input
              aria-label={labels.search}
              className="h-9 w-44 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-[13px] text-slate-700 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 sm:w-56"
              onChange={(event) => {
                onSearchValueChange(event.target.value);
              }}
              placeholder={labels.searchPlaceholder}
              type="text"
              value={searchValue}
            />
            {searchValue ? (
              <button
                aria-label={labels.clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-0.5 text-[13px] font-bold leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                onClick={() => {
                  onSearchValueChange('');
                }}
                type="button"
              >
                ✕
              </button>
            ) : null}
          </div>
          <button
            className="h-9 cursor-pointer whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            type="submit"
          >
            {labels.search}
          </button>

          <div className="flex flex-wrap items-center gap-2 ml-2">
            {labels.status ? (
              <label className="flex items-center gap-2">
                <span className="sr-only">{labels.status}</span>
                <select
                  aria-label={labels.status}
                  className="h-9 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  onChange={(event) => {
                    onStatusChange(event.target.value as RecordStatus);
                  }}
                  value={status}
                >
                  <option value="active">{labels.statusActive}</option>
                  <option value="archived">{labels.statusArchived}</option>
                </select>
              </label>
            ) : null}

            {classLevels && onClassLevelChange && labels.classLevel ? (
              <label className="flex items-center gap-2">
                <span className="sr-only">{labels.classLevel}</span>
                <select
                  aria-label={labels.classLevel}
                  className="h-9 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  onChange={(event) => {
                    onClassLevelChange(event.target.value || null);
                  }}
                  value={classLevelId ?? ''}
                >
                  <option value="">{labels.allLevels ?? ''}</option>
                  {classLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {classrooms && onClassroomChange && labels.classroom ? (
              <label className="flex items-center gap-2">
                <span className="sr-only">{labels.classroom}</span>
                <select
                  aria-label={labels.classroom}
                  className="h-9 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  onChange={(event) => {
                    onClassroomChange(event.target.value || null);
                  }}
                  value={classroomId ?? ''}
                >
                  <option value="">{labels.allClassrooms ?? ''}</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {onSexChange && labels.sex ? (
              <label className="flex items-center gap-2">
                <span className="sr-only">{labels.sex}</span>
                <select
                  aria-label={labels.sex}
                  className="h-9 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  onChange={(event) => {
                    onSexChange(
                      event.target.value === '' ? null : (event.target.value as PersonSex)
                    );
                  }}
                  value={sex ?? ''}
                >
                  <option value="">{labels.allSexes ?? ''}</option>
                  <option value="M">{labels.sexMale ?? 'M'}</option>
                  <option value="F">{labels.sexFemale ?? 'F'}</option>
                </select>
              </label>
            ) : null}
          </div>
        </form>
      </div>

      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 sm:block" />
        {onImport && labels.import ? (
          <button
            className="h-9 cursor-pointer whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={onImport}
            type="button"
          >
            {labels.import}
          </button>
        ) : null}
        <button
          className="h-9 cursor-pointer whitespace-nowrap rounded-xl bg-teal-500 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          onClick={onNew}
          type="button"
        >
          {labels.new}
        </button>
      </div>
    </div>
  );
}

export function Pagination({
  list,
  pageLabel,
  onNext,
  onPrevious,
}: {
  list: { limit: number; offset: number; pageCount: number; total: number };
  pageLabel: (current: number, total: number) => string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const currentPage = Math.floor(list.offset / list.limit) + 1;

  return (
    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
      <p className="text-[12px] font-bold text-slate-400">
        {pageLabel(currentPage, list.pageCount)}
      </p>
      <div className="flex items-center gap-2">
        <button
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
          disabled={list.offset === 0}
          onClick={onPrevious}
          type="button"
        >
          ←
        </button>
        <button
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
          disabled={list.offset + list.limit >= list.total}
          onClick={onNext}
          type="button"
        >
          →
        </button>
      </div>
    </div>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm font-bold text-slate-400" colSpan={5}>
        {message}
      </td>
    </tr>
  );
}

export function StatusBadge({
  active,
  activeLabel,
  archivedLabel,
}: {
  active: boolean;
  activeLabel: string;
  archivedLabel: string;
}) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/60 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
      {activeLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {archivedLabel}
    </span>
  );
}

export function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-bold text-slate-700">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Archive / reactivate confirm dialog (reason required)
// ---------------------------------------------------------------------------

export interface ArchiveDialogLabels {
  title: string;
  body: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  reasonRequiredMessage: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function ArchiveDialog({
  labels,
  onClose,
  onConfirm,
}: {
  labels: ArchiveDialogLabels;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  return (
    <ModalShell closeLabel={labels.cancelLabel} onClose={onClose} title={labels.title}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (reason.trim().length < 3) {
            setErrorKey(labels.reasonRequiredMessage);
            return;
          }

          setErrorKey(null);
          void onConfirm(reason.trim()).catch(() => undefined);
        }}
      >
        <p className="text-[13px] font-semibold leading-6 text-slate-500">{labels.body}</p>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-slate-800">{labels.reasonLabel}</span>
          <textarea
            className="min-h-[80px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder={labels.reasonPlaceholder}
            value={reason}
          />
        </label>

        {errorKey ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {errorKey}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <ModalCancelButton label={labels.cancelLabel} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-400"
            type="submit"
          >
            {labels.confirmLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
