import type {
  AcademicYearStatus,
  AcademicYearWithTerms,
  AcademicYearsResponse,
  CreateAcademicYearRequest,
  DraftTermInput,
} from '@edutrack/shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../../components/DatePicker';
import { formatISODate } from '../../components/dateFormat';
import { formInputClassName, ModalCancelButton, ModalShell } from '../people/ui';
import type { ConfigurationClient } from './ConfigurationModule';
import {
  changeAcademicYearStatus as changeAcademicYearStatusRequest,
  ConfigurationApiError,
  createAcademicYear as createAcademicYearRequest,
  listAcademicYears,
  resolveConfigurationErrorMessageKey,
} from './configurationApi';

/**
 * Academic-year lifecycle manager (roadmap §9.3): lists the school's years
 * with their terms, creates DRAFT years and activates/closes them. Activation
 * rolls the school over (previous ACTIVE year is closed by the backend).
 */
export function AcademicYearsSection({
  apiBaseUrl,
  capabilityToken,
  client,
  onSessionExpired,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ConfigurationClient;
  onSessionExpired?: () => void;
}) {
  const { t } = useTranslation();
  const [response, setResponse] = useState<AcademicYearsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const requestOptions = useCallback(
    () => ({
      ...(capabilityToken ? { capabilityToken } : {}),
    }),
    [capabilityToken]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorKey(null);

    try {
      const data = client?.listAcademicYears
        ? await client.listAcademicYears()
        : await listAcademicYears(apiBaseUrl ?? '', requestOptions());
      setResponse(data);
    } catch (error) {
      if (error instanceof ConfigurationApiError && error.code === 'INVALID_ACCESS_TOKEN') {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, client, onSessionExpired, requestOptions]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [apiBaseUrl, capabilityToken, client, load]);

  const activeYear = response?.years.find((year) => year.status === 'ACTIVE') ?? null;

  const handleStatusChange = async (year: AcademicYearWithTerms, status: 'ACTIVE' | 'CLOSED') => {
    setIsMutating(true);
    setErrorKey(null);

    try {
      if (client?.changeAcademicYearStatus) {
        await client.changeAcademicYearStatus(year.id, { status });
      } else {
        await changeAcademicYearStatusRequest(
          apiBaseUrl ?? '',
          year.id,
          { status },
          requestOptions()
        );
      }

      await load();
    } catch (error) {
      if (error instanceof ConfigurationApiError && error.code === 'INVALID_ACCESS_TOKEN') {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <section
      aria-labelledby="configuration-years-title"
      className="space-y-4 rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            className="text-base font-black tracking-tight text-slate-900"
            id="configuration-years-title"
          >
            {t('configuration.years.title')}
          </h2>
          <p className="mt-1 text-[12px] font-semibold text-slate-400">
            {t('configuration.years.hint')}
          </p>
        </div>
        <button
          className="cursor-pointer rounded-2xl bg-teal-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          onClick={() => {
            setErrorKey(null);
            setIsCreating(true);
          }}
          type="button"
        >
          {t('configuration.years.new')}
        </button>
      </div>

      {errorKey ? (
        <div
          aria-live="polite"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
          role="alert"
        >
          {t(errorKey)}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
        </div>
      ) : response && response.years.length > 0 ? (
        <div className="space-y-3">
          {response.years.map((year) => (
            <article
              className="flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-slate-50/40 p-5 transition-all hover:border-slate-300/70 lg:flex-row lg:items-center lg:justify-between"
              key={year.id}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-black text-slate-800">{year.label}</h3>
                  <YearStatusPill status={year.status} />
                  {year.isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200/60">
                      {t('configuration.years.current')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  {year.startDate ? formatISODate(year.startDate) : '—'} →{' '}
                  {year.endDate ? formatISODate(year.endDate) : '—'}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {year.terms.map((termItem) => (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        termItem.isCurrent
                          ? 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200'
                          : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200'
                      }`}
                      key={termItem.id}
                    >
                      {termItem.label}
                      {termItem.isCurrent ? ` · ${t('configuration.years.currentTerm')}` : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {year.status === 'DRAFT' || year.status === 'CLOSED' ? (
                  <button
                    className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isMutating}
                    onClick={() => {
                      void handleStatusChange(year, 'ACTIVE');
                    }}
                    type="button"
                  >
                    {t('configuration.years.activate')}
                  </button>
                ) : null}
                {year.status === 'ACTIVE' ? (
                  <button
                    className="cursor-pointer rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isMutating}
                    onClick={() => {
                      void handleStatusChange(year, 'CLOSED');
                    }}
                    type="button"
                  >
                    {t('configuration.years.close')}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
          <p className="text-sm font-black text-slate-500">{t('configuration.years.empty')}</p>
          <p className="mt-1 text-[12px] font-semibold text-slate-400">
            {t('configuration.years.emptyHint', { active: activeYear?.label ?? '—' })}
          </p>
        </div>
      )}

      {isCreating ? (
        <CreateYearModal
          apiBaseUrl={apiBaseUrl}
          {...(client ? { client } : {})}
          onClose={() => {
            setIsCreating(false);
          }}
          onCreated={async () => {
            setIsCreating(false);
            await load();
          }}
          {...(onSessionExpired ? { onSessionExpired } : {})}
          requestOptions={requestOptions()}
        />
      ) : null}
    </section>
  );
}

function YearStatusPill({ status }: { status: AcademicYearStatus }) {
  const { t } = useTranslation();
  const palette =
    status === 'ACTIVE'
      ? 'bg-teal-50 text-teal-700 ring-teal-200'
      : status === 'CLOSED'
        ? 'bg-slate-100 text-slate-500 ring-slate-200'
        : 'bg-amber-50 text-amber-700 ring-amber-200';

  const labelKey =
    status === 'ACTIVE'
      ? 'configuration.years.statusActive'
      : status === 'CLOSED'
        ? 'configuration.years.statusClosed'
        : 'configuration.years.statusDraft';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${palette}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'ACTIVE'
            ? 'bg-teal-500'
            : status === 'CLOSED'
              ? 'bg-slate-400'
              : 'bg-amber-500'
        }`}
      />
      {t(labelKey)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create-year modal
// ---------------------------------------------------------------------------

const DEFAULT_TERM_LABELS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

interface CreateYearModalProps {
  apiBaseUrl: string | null;
  client?: ConfigurationClient;
  requestOptions: { capabilityToken?: string };
  onClose: () => void;
  onCreated: () => Promise<void>;
  onSessionExpired?: () => void;
}

function CreateYearModal({
  apiBaseUrl,
  client,
  requestOptions,
  onClose,
  onCreated,
  onSessionExpired,
}: CreateYearModalProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [termCount, setTermCount] = useState(3);
  const [terms, setTerms] = useState<DraftTermInput[]>(
    DEFAULT_TERM_LABELS.map((termLabel, index) => ({
      label: termLabel,
      termNumber: index + 1,
      startDate: '',
      endDate: '',
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null);

  const updateTerm = (index: number, patch: Partial<DraftTermInput>) => {
    setTerms((current) =>
      current.map((termItem, i) => (i === index ? { ...termItem, ...patch } : termItem))
    );
  };

  const handleSubmit = async () => {
    const hasInvalidTerm = terms
      .slice(0, termCount)
      .some((termItem) => !termItem.label || !termItem.startDate || !termItem.endDate);

    if (label.trim().length < 4 || !startDate || !endDate || hasInvalidTerm) {
      setLocalErrorKey('configuration.years.validation');
      return;
    }

    const input: CreateAcademicYearRequest = {
      label: label.trim(),
      startDate,
      endDate,
      terms: terms.slice(0, termCount),
    };

    setIsSubmitting(true);
    setLocalErrorKey(null);

    try {
      if (client?.createAcademicYear) {
        await client.createAcademicYear(input);
      } else {
        await createAcademicYearRequest(apiBaseUrl ?? '', input, requestOptions);
      }

      await onCreated();
    } catch (error) {
      if (error instanceof ConfigurationApiError && error.code === 'INVALID_ACCESS_TOKEN') {
        onSessionExpired?.();
        return;
      }

      setLocalErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      closeLabel={t('configuration.cancel')}
      onClose={onClose}
      title={t('configuration.years.newTitle')}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-slate-800">
            {t('configuration.years.label')} *
          </span>
          <input
            className={formInputClassName}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            placeholder={t('configuration.years.labelPlaceholder')}
            value={label}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {t('configuration.years.startDate')} *
            </span>
            <DatePicker onChange={setStartDate} value={startDate} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {t('configuration.years.endDate')} *
            </span>
            <DatePicker onChange={setEndDate} value={endDate} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-slate-800">
            {t('configuration.years.termCount')}
          </span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[2, 3].map((count) => (
              <button
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                  termCount === count
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                key={count}
                onClick={() => {
                  setTermCount(count);
                }}
                type="button"
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {terms.slice(0, termCount).map((termItem, index) => (
          <div
            className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4"
            key={index}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {t('configuration.years.period', { number: String(index + 1) })}
              </span>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-slate-800">
                {t('configuration.years.periodLabel')} *
              </span>
              <input
                className={formInputClassName}
                onChange={(event) => {
                  updateTerm(index, { label: event.target.value });
                }}
                placeholder={t('configuration.years.periodLabelPlaceholder', {
                  number: String(index + 1),
                })}
                value={termItem.label}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-bold text-slate-800">
                  {t('configuration.years.startDate')} *
                </span>
                <DatePicker
                  onChange={(date) => {
                    updateTerm(index, { startDate: date });
                  }}
                  value={termItem.startDate}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-bold text-slate-800">
                  {t('configuration.years.endDate')} *
                </span>
                <DatePicker
                  onChange={(date) => {
                    updateTerm(index, { endDate: date });
                  }}
                  value={termItem.endDate}
                />
              </label>
            </div>
          </div>
        ))}

        {localErrorKey ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700"
            role="alert"
          >
            {t(localErrorKey)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <ModalCancelButton label={t('configuration.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t('configuration.saving') : t('configuration.years.create')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
