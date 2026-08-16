import {
  type AppreciationBandInput,
  type AppreciationScaleInput,
  type AppreciationScaleView,
  type AppreciationScalesResponse,
} from '@edutrack/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName, ModalShell } from '../people/ui';
import { ConfigurationApiError, resolveConfigurationErrorMessageKey } from './configurationApi';
import { DecimalField } from './DecimalField';
import { formatHundredths, parseDecimalToHundredths } from './gradingFormat';

export interface AppreciationClient {
  list?: () => Promise<AppreciationScalesResponse>;
  create?: (input: AppreciationScaleInput) => Promise<AppreciationScaleView>;
  update?: (scaleId: string, input: AppreciationScaleInput) => Promise<AppreciationScaleView>;
  publish?: (scaleId: string) => Promise<AppreciationScaleView>;
  duplicate?: (scaleId: string) => Promise<AppreciationScaleView>;
}

export interface AppreciationSectionProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: AppreciationClient;
  readOnly?: boolean;
  onSessionExpired?: () => void;
}

export function AppreciationSection({
  apiBaseUrl,
  capabilityToken,
  client,
  readOnly = false,
  onSessionExpired,
}: AppreciationSectionProps) {
  const { t } = useTranslation();
  const [scales, setScales] = useState<AppreciationScaleView[]>([]);
  const [selected, setSelected] = useState<AppreciationScaleView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const requestOptions = useCallback(
    () => ({ ...(capabilityToken ? { capabilityToken } : {}) }),
    [capabilityToken]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorKey(null);

    try {
      const data = client?.list
        ? await client.list()
        : await fetchScales(apiBaseUrl ?? '', requestOptions());
      setScales(data.scales);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpiredRef.current?.();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, client, requestOptions]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [load]);

  const handleSaved = (scale: AppreciationScaleView) => {
    setSelected(scale);
    setEditorOpen(false);
    void load();
  };

  const summaries = scales;

  return (
    <section
      aria-labelledby="configuration-appreciation-title"
      className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-100/50">
            <StarIcon />
          </div>
          <div>
            <h2
              className="text-base font-black tracking-tight text-slate-900"
              id="configuration-appreciation-title"
            >
              {t('configuration.appreciation.title')}
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('configuration.appreciation.hint')}
            </p>
          </div>
        </div>
        {!readOnly ? (
          <button
            className="cursor-pointer rounded-2xl bg-teal-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              setEditorOpen(true);
              setSelected(null);
            }}
            type="button"
          >
            {t('configuration.appreciation.new')}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div aria-live="polite" className="flex h-32 items-center justify-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
        </div>
      ) : errorKey ? (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-bold text-red-700">{t(errorKey)}</p>
          <button
            className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700"
            onClick={() => void load()}
            type="button"
          >
            {t('configuration.retry')}
          </button>
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <p className="text-sm font-black text-slate-600">
            {t('configuration.appreciation.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((scale) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 p-4 transition-shadow hover:shadow-sm"
              key={scale.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-black text-slate-800">{scale.name}</p>
                  <StatusPill status={scale.status} />
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {t('configuration.appreciation.version', { version: String(scale.version) })} ·{' '}
                  {t('configuration.appreciation.scale', { scale: String(scale.scaleMax) })}
                </p>
              </div>
              {!readOnly ? (
                <div className="flex items-center gap-2">
                  {scale.status === 'DRAFT' ? (
                    <button
                      className="cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-700"
                      onClick={() => {
                        setSelected(scale);
                        setEditorOpen(true);
                      }}
                      type="button"
                    >
                      {t('configuration.appreciation.edit')}
                    </button>
                  ) : (
                    <button
                      className="cursor-pointer rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                      onClick={() => void handleDuplicate(scale.id)}
                      type="button"
                    >
                      {t('configuration.appreciation.duplicate')}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editorOpen ? (
        <AppreciationEditor
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          existing={selected}
          onClose={() => {
            setEditorOpen(false);
          }}
          onSaved={handleSaved}
          onSessionExpired={() => onSessionExpiredRef.current?.()}
        />
      ) : null}
    </section>
  );

  async function handleDuplicate(scaleId: string) {
    setErrorKey(null);
    try {
      if (client?.duplicate) {
        await client.duplicate(scaleId);
      } else {
        const { duplicateAppreciationScale } = await import('./configurationApi');
        await duplicateAppreciationScale(apiBaseUrl ?? '', scaleId, requestOptions());
      }
      await load();
    } catch (error) {
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    }
  }
}

// ---------------------------------------------------------------------------
// Band editor with live preview
// ---------------------------------------------------------------------------

function AppreciationEditor({
  apiBaseUrl,
  capabilityToken,
  client,
  existing,
  onClose,
  onSaved,
  onSessionExpired,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: AppreciationClient;
  existing: AppreciationScaleView | null;
  onClose: () => void;
  onSaved: (scale: AppreciationScaleView) => void;
  onSessionExpired: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(existing?.name ?? '');
  const [scaleMax, setScaleMax] = useState(existing?.scaleMax ?? 20);
  const [bands, setBands] = useState<AppreciationBandInput[]>(() =>
    existing
      ? existing.bands.map((band) => ({
          id: band.id,
          lowerBound: band.lowerBound,
          upperBound: band.upperBound,
          labelFr: band.labelFr,
          labelAr: band.labelAr,
          labelEn: band.labelEn,
          shortLabel: band.shortLabel,
          displayOrder: band.displayOrder,
        }))
      : defaultBands()
  );
  const [previewAverage, setPreviewAverage] = useState('14,37');
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Only a non-null existing scale can be published; a null existing means
  // the create flow, where nothing is published yet.
  const isPublished = existing ? existing.status !== 'DRAFT' : false;
  const warnings = bandWarnings(bands, scaleMax);
  const preview = findPreviewBand(bands, previewAverage);

  const handleSave = async () => {
    if (isPublished) {
      return;
    }
    setIsSaving(true);
    setErrorKey(null);
    setFieldErrors({});

    const input: AppreciationScaleInput = { name, scaleMax, bands };

    try {
      let result: AppreciationScaleView;
      if (existing && client?.update) {
        result = await client.update(existing.id, input);
      } else if (existing) {
        result = await saveViaApi('update', apiBaseUrl ?? '', existing.id, input, capabilityToken);
      } else if (client?.create) {
        result = await client.create(input);
      } else {
        result = await saveViaApi('create', apiBaseUrl ?? '', '', input, capabilityToken);
      }
      onSaved(result);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isPublished || !existing) {
      return;
    }
    setIsSaving(true);
    setErrorKey(null);
    setFieldErrors({});

    try {
      const result = client?.publish
        ? await client.publish(existing.id)
        : await (async () => {
            const { publishAppreciationScale } = await import('./configurationApi');
            return publishAppreciationScale(apiBaseUrl ?? '', existing.id, {
              ...(capabilityToken ? { capabilityToken } : {}),
            });
          })();
      onSaved(result);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateBand = (index: number, patch: Partial<AppreciationBandInput>) => {
    setBands((current) =>
      current.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band))
    );
  };

  return (
    <ModalShell
      closeLabel={t('configuration.cancel')}
      onClose={onClose}
      resizeLabel={t('configuration.resize')}
      title={
        existing
          ? t('configuration.appreciation.editTitle')
          : t('configuration.appreciation.newTitle')
      }
    >
      <div className="space-y-4">
        {isPublished ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-700">
            {t('configuration.appreciation.publishedNote')}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {t('configuration.appreciation.name')}
            </span>
            <input
              className={formInputClassName}
              disabled={isPublished}
              onChange={(event) => {
                setName(event.target.value);
              }}
              value={name}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {t('configuration.appreciation.scaleMax')}
            </span>
            <input
              className={formInputClassName}
              disabled={isPublished}
              max={100}
              min={1}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                setScaleMax(Number.isFinite(value) ? value : 20);
              }}
              type="number"
              value={scaleMax}
            />
            <span className="text-[11px] font-semibold text-slate-400">
              {t('configuration.appreciation.scaleMaxHint')}
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-black uppercase tracking-widest text-slate-500">
            {t('configuration.appreciation.bandsTitle')}
          </p>
          {bands.map((band, index) => (
            <div
              className="grid gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/40 p-3 sm:grid-cols-[90px_90px_1fr_90px]"
              key={band.id ?? index}
            >
              <DecimalField
                ariaLabel={t('configuration.appreciation.from')}
                className={formInputClassName}
                disabled={isPublished}
                onChange={(hundredths) => {
                  updateBand(index, { lowerBound: hundredths });
                }}
                scaleMax={scaleMax}
                value={band.lowerBound}
              />
              <DecimalField
                ariaLabel={t('configuration.appreciation.to')}
                className={formInputClassName}
                disabled={isPublished}
                onChange={(hundredths) => {
                  updateBand(index, { upperBound: hundredths });
                }}
                scaleMax={scaleMax}
                value={band.upperBound}
              />
              <input
                aria-label={t('configuration.appreciation.label')}
                className={formInputClassName}
                disabled={isPublished}
                onChange={(event) => {
                  updateBand(index, { labelFr: event.target.value });
                }}
                placeholder="Appréciation (fr)"
                value={band.labelFr}
              />
              <div className="flex items-center gap-1">
                <input
                  aria-label={t('configuration.appreciation.shortLabel')}
                  className={formInputClassName}
                  disabled={isPublished}
                  onChange={(event) => {
                    updateBand(index, { shortLabel: event.target.value });
                  }}
                  placeholder="Sigle"
                  value={band.shortLabel}
                />
                {!isPublished ? (
                  <button
                    aria-label={t('configuration.appreciation.removeBand')}
                    className="cursor-pointer rounded-xl px-2 py-1 text-sm font-black text-red-400 hover:bg-red-50"
                    onClick={() => {
                      setBands((current) => current.filter((_, bandIndex) => bandIndex !== index));
                    }}
                    type="button"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!isPublished ? (
            <button
              className="cursor-pointer rounded-2xl border border-dashed border-teal-300 px-4 py-2.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50"
              onClick={() => {
                setBands((current) => [
                  ...current,
                  {
                    lowerBound: 0,
                    upperBound: 0,
                    labelFr: '',
                    labelAr: '',
                    labelEn: '',
                    shortLabel: '',
                    displayOrder: current.length + 1,
                  },
                ]);
              }}
              type="button"
            >
              + {t('configuration.appreciation.addBand')}
            </button>
          ) : null}
        </div>

        {warnings.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-amber-700">
              {t('configuration.appreciation.warningsTitle')}
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold text-amber-800">
              {warnings.map((warning, index) => (
                <li key={index}>
                  • {warning.params ? t(warning.key, warning.params) : t(warning.key)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Live preview */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              {t('configuration.appreciation.previewLabel')}
              <input
                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-600/10"
                onChange={(event) => {
                  setPreviewAverage(event.target.value);
                }}
                value={previewAverage}
              />
            </label>
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {t('configuration.appreciation.previewResult')}
              </p>
              <p className="text-xl font-black text-slate-900">
                {preview?.labelFr ?? t('configuration.appreciation.previewNone')}
              </p>
            </div>
          </div>
        </div>

        {errorKey ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
            role="alert"
          >
            {t(errorKey)}
            {Object.values(fieldErrors).length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs font-semibold">
                {Object.entries(fieldErrors).map(([code, message]) => (
                  <li key={code}>• {message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            {t('configuration.cancel')}
          </button>
          {isPublished ? null : (
            <button
              className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
              disabled={isSaving}
              onClick={() => void handleSave()}
              type="button"
            >
              {t('configuration.appreciation.saveDraft')}
            </button>
          )}
          {isPublished ? null : (
            <button
              className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving || warnings.length > 0}
              onClick={() => void handlePublish()}
              type="button"
            >
              {t('configuration.appreciation.publish')}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function StatusPill({ status }: { status: AppreciationScaleView['status'] }) {
  const { t } = useTranslation();

  const styles: Record<AppreciationScaleView['status'], string> = {
    DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
    PUBLISHED: 'bg-teal-50 text-teal-700 ring-teal-200',
    SUPERSEDED: 'bg-amber-50 text-amber-700 ring-amber-200',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${styles[status]}`}
    >
      {t(`configuration.grading.status.${status.toLowerCase()}`)}
    </span>
  );
}

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M12 3l2.7 5.6 6.3.8-4.6 4.3 1.2 6.1L12 17.9 6.4 19.8l1.2-6.1L3 9.4l6.3-.8L12 3z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function defaultBands(): AppreciationBandInput[] {
  // Chadian secondary starting point (design §14): 18-20 Excellent, 16-17.99
  // Très Bien, 14-15.99 Bien, 12-13.99 Assez Bien, 10-11.99 Passable,
  // 8-9.99 Insuffisant, 6-7.99 Faible, 0-5.99 Très Faible. Editable.
  return [
    {
      lowerBound: 1800,
      upperBound: 2000,
      labelFr: 'Excellent',
      labelAr: 'ممتاز',
      labelEn: 'Excellent',
      shortLabel: 'Exc',
      displayOrder: 1,
    },
    {
      lowerBound: 1600,
      upperBound: 1799,
      labelFr: 'Très bien',
      labelAr: 'جيد جداً',
      labelEn: 'Very good',
      shortLabel: 'TB',
      displayOrder: 2,
    },
    {
      lowerBound: 1400,
      upperBound: 1599,
      labelFr: 'Bien',
      labelAr: 'جيد',
      labelEn: 'Good',
      shortLabel: 'B',
      displayOrder: 3,
    },
    {
      lowerBound: 1200,
      upperBound: 1399,
      labelFr: 'Assez bien',
      labelAr: 'لا بأس به',
      labelEn: 'Fairly good',
      shortLabel: 'AB',
      displayOrder: 4,
    },
    {
      lowerBound: 1000,
      upperBound: 1199,
      labelFr: 'Passable',
      labelAr: 'مقبول',
      labelEn: 'Passable',
      shortLabel: 'P',
      displayOrder: 5,
    },
    {
      lowerBound: 800,
      upperBound: 999,
      labelFr: 'Insuffisant',
      labelAr: 'غير كاف',
      labelEn: 'Insufficient',
      shortLabel: 'I',
      displayOrder: 6,
    },
    {
      lowerBound: 600,
      upperBound: 799,
      labelFr: 'Faible',
      labelAr: 'ضعيف',
      labelEn: 'Weak',
      shortLabel: 'F',
      displayOrder: 7,
    },
    {
      lowerBound: 0,
      upperBound: 599,
      labelFr: 'Très faible',
      labelAr: 'ضعيف جداً',
      labelEn: 'Very weak',
      shortLabel: 'TF',
      displayOrder: 8,
    },
  ];
}

function bandWarnings(
  bands: AppreciationBandInput[],
  scaleMax: number
): { key: string; params?: Record<string, string> }[] {
  const warnings: { key: string; params?: Record<string, string> }[] = [];
  const sorted = [...bands].sort((a, b) => b.lowerBound - a.lowerBound);
  const scaleHundredths = scaleMax * 100;

  for (const band of sorted) {
    if (band.lowerBound > band.upperBound) {
      warnings.push({ key: 'configuration.appreciation.warnInverted' });
    }
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const band = sorted[index];
    const next = sorted[index + 1];
    if (!band || !next) {
      continue;
    }
    if (next.upperBound + 1 < band.lowerBound) {
      warnings.push({
        key: 'configuration.appreciation.warnGap',
        params: {
          from: formatHundredths(next.upperBound),
          to: formatHundredths(band.lowerBound),
        },
      });
    }
    if (next.upperBound >= band.lowerBound) {
      warnings.push({ key: 'configuration.appreciation.warnOverlap' });
    }
  }
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  if (highest && highest.upperBound < scaleHundredths) {
    warnings.push({ key: 'configuration.appreciation.warnReachTop' });
  }
  if (lowest && lowest.lowerBound > 0) {
    warnings.push({ key: 'configuration.appreciation.warnStartZero' });
  }

  return warnings;
}

function findPreviewBand(bands: AppreciationBandInput[], average: string) {
  const hundredths = parseDecimalToHundredths(average);
  const sorted = [...bands].sort((a, b) => b.lowerBound - a.lowerBound);
  return (
    sorted.find((band) => hundredths >= band.lowerBound && hundredths <= band.upperBound) ?? null
  );
}

function extractFieldErrors(error: unknown): Record<string, string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'fields' in error &&
    typeof (error as { fields?: unknown }).fields === 'object' &&
    (error as { fields?: Record<string, string> }).fields
  ) {
    return (error as { fields: Record<string, string> }).fields;
  }
  return {};
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}

async function fetchScales(apiBaseUrl: string, options: { capabilityToken?: string }) {
  const { listAppreciationScales } = await import('./configurationApi');
  return listAppreciationScales(apiBaseUrl, options);
}

async function saveViaApi(
  kind: 'create' | 'update',
  apiBaseUrl: string,
  scaleId: string,
  input: AppreciationScaleInput,
  capabilityToken?: string
) {
  const { createAppreciationScale, updateAppreciationScale } = await import('./configurationApi');
  if (!apiBaseUrl) {
    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }
  const options = { ...(capabilityToken ? { capabilityToken } : {}) };
  return kind === 'create'
    ? createAppreciationScale(apiBaseUrl, input, options)
    : updateAppreciationScale(apiBaseUrl, scaleId, input, options);
}
