import type { RecordStatus } from '@edutrack/shared';
import { useEffect, useRef, useState } from 'react';

export const formInputClassName =
  'h-[50px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10';
export const formSelectClassName =
  'h-[50px] w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10';

// ---------------------------------------------------------------------------
// Modal building blocks
// ---------------------------------------------------------------------------

export function ModalShell({
  title,
  closeLabel,
  onClose,
  size = 'md',
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  /** 'lg' is for content-heavy steps (e.g. the import preview table). */
  size?: 'md' | 'lg';
  children: React.ReactNode;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-white bg-white p-6 shadow-2xl ${
          size === 'lg' ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
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
  placeholderOption = '—',
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
}

/**
 * Shared list toolbar: result count, live search with an explicit clear
 * control, a "Filtres" panel (status for now), and the create action in a
 * separate zone behind a divider.
 */
export function ListToolbar({
  labels,
  onImport,
  onNew,
  onSearch,
  onSearchValueChange,
  onStatusChange,
  searchValue,
  status,
}: {
  labels: ListToolbarLabels;
  onImport?: () => void;
  onNew: () => void;
  onSearch: (search: string) => void;
  onSearchValueChange: (value: string) => void;
  onStatusChange: (status: RecordStatus) => void;
  searchValue: string;
  status: RecordStatus;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filtersOpen]);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] font-bold text-slate-500">{labels.count}</p>

        <form
          className="flex items-center gap-2"
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

          <div className="relative" ref={filtersRef}>
            <button
              aria-expanded={filtersOpen}
              className="h-9 cursor-pointer whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setFiltersOpen((open) => !open);
              }}
              type="button"
            >
              {labels.filter}
              <span className="ml-1 text-slate-400">{filtersOpen ? '▲' : '▼'}</span>
            </button>
            {filtersOpen ? (
              <div className="absolute right-0 top-full z-30 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-800">{labels.status}</span>
                  <select
                    className={`${formSelectClassName} h-10`}
                    onChange={(event) => {
                      onStatusChange(event.target.value as RecordStatus);
                    }}
                    value={status}
                  >
                    <option value="active">{labels.statusActive}</option>
                    <option value="archived">{labels.statusArchived}</option>
                  </select>
                </label>
                {/*
                  TODO(roadmap §9.x): add the class-level (Niveau) filter once
                  Classes + enrollment ship; it must query the enrollment
                  relationship, not a raw field on the person record.
                  TODO: add the sex filter (lower priority; the field exists).
                */}
              </div>
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
