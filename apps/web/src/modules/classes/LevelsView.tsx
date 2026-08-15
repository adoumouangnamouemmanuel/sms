import type {
  SetupClassLevelInput,
  SetupClassLevelsRequest,
  SetupStateResponse,
} from '@edutrack/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName } from '../people/ui';
import { saveSetupClassLevels } from '../setup/setupApi';
import { resolveSetupErrorMessageKey } from '../setup/setupErrors';
import { listClassrooms, type ClassesRequestOptions } from './classesApi';
import type { ClassesClient } from './useClassesState';

/** ClassesClient extended with the setup-backed level save used by this view. */
export interface LevelsClient extends ClassesClient {
  saveClassLevels?: (input: SetupClassLevelsRequest) => Promise<SetupStateResponse>;
}

export interface LevelsViewProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: LevelsClient;
  setupState: SetupStateResponse;
  onSetupStateChange?: (state: SetupStateResponse) => void;
  onSessionExpired?: () => void;
}

type DraftLevel = SetupClassLevelInput & { rowId: string };

export function LevelsView({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  onSetupStateChange,
  onSessionExpired,
}: LevelsViewProps) {
  const { t } = useTranslation();
  const requestOptions = useCallback(
    (): ClassesRequestOptions => (capabilityToken ? { capabilityToken } : {}),
    [capabilityToken]
  );

  const [perLevelCounts, setPerLevelCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<DraftLevel[]>(() => toDraft(setupState.classLevels));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadClassroomCounts = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    try {
      const response = client
        ? await client.listClassrooms({ limit: 100, offset: 0 }, requestOptions())
        : await listClassrooms(apiBaseUrl ?? '', { limit: 100, offset: 0 }, requestOptions());
      const counts: Record<string, number> = {};
      for (const item of response.items) {
        counts[item.classroom.classLevelId] = (counts[item.classroom.classLevelId] ?? 0) + 1;
      }
      setPerLevelCounts(counts);
    } catch {
      // Counts are decorative — a failure here must not block the levels UI.
    }
  }, [apiBaseUrl, client, requestOptions]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadClassroomCounts();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [loadClassroomCounts]);

  const updateLevel = (rowId: string, patch: Partial<SetupClassLevelInput>) => {
    setDraft((current) =>
      current.map((level) => (level.rowId === rowId ? { ...level, ...patch } : level))
    );
  };

  const removeLevel = (rowId: string) => {
    setDraft((current) => current.filter((level) => level.rowId !== rowId));
  };

  const addLevel = () => {
    setDraft((current) => [
      ...current,
      {
        code: `LVL-${String(current.length + 1).padStart(2, '0')}`,
        name: '',
        displayOrder: 0, // Ignored; derived on save
        isExamYear: false,
        rowId: crypto.randomUUID(),
      },
    ]);
  };

  const handleSave = async () => {
    if (!apiBaseUrl && !client) {
      setErrorKey('classes.errors.localService');
      return;
    }

    const hasInvalid = draft.some((level) => level.name.trim().length < 2);
    if (hasInvalid || draft.length === 0) {
      setErrorKey('classes.errors.invalidRows');
      return;
    }

    const valid = draft.map((level, index) => ({
      code: level.code,
      name: level.name.trim(),
      displayOrder: index + 1,
      isExamYear: level.isExamYear,
    }));

    setIsSaving(true);
    setErrorKey(null);
    setSaved(false);

    try {
      const nextState = client?.saveClassLevels
        ? await client.saveClassLevels({ classLevels: valid })
        : await saveSetupClassLevels(apiBaseUrl ?? '', { classLevels: valid }, requestOptions());
      onSetupStateChange?.(nextState);
      setDraft(toDraft(nextState.classLevels));
      setIsEditing(false);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }
      setErrorKey(resolveSetupErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const totalClassrooms = useMemo(
    () => Object.values(perLevelCounts).reduce((sum, count) => sum + count, 0),
    [perLevelCounts]
  );

  return (
    <div className="space-y-5">
      {errorKey ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {t(errorKey)}
        </div>
      ) : null}

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <SummaryCard
          label={t('classes.levels.summary.levels')}
          tone="teal"
          value={setupState.classLevels.length}
        />
        <SummaryCard
          label={t('classes.levels.summary.classrooms')}
          tone="indigo"
          value={totalClassrooms}
        />
        <SummaryCard
          label={t('classes.levels.summary.examYears')}
          tone="amber"
          value={setupState.classLevels.filter((level) => level.isExamYear).length}
        />
      </div>

      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-900">
              {t('classes.levels.title')}
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('classes.levels.hint')}
            </p>
          </div>
          {!isEditing && (
            <button
              className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setErrorKey(null);
                setSaved(false);
                setIsEditing(true);
              }}
              type="button"
            >
              <span className="relative z-10">{t('classes.levels.edit')}</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {draft.map((level, index) => (
              <div
                className="group flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200/60 bg-slate-50/50 p-4 transition-all hover:border-slate-300/80 hover:bg-slate-50"
                key={level.rowId}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[13px] font-black text-slate-400 shadow-sm ring-1 ring-slate-200/80">
                  {index + 1}
                </div>
                <input
                  aria-label={`${t('classes.levels.name')} ${String(index + 1)}`}
                  className={`${formInputClassName} h-12 min-w-[160px] flex-1 rounded-2xl border-slate-200/80 bg-white text-sm font-bold placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500`}
                  onChange={(event) => {
                    updateLevel(level.rowId, { name: event.target.value });
                  }}
                  placeholder={t('classes.levels.namePlaceholder')}
                  value={level.name}
                />
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 shadow-sm transition-colors hover:bg-slate-50">
                  <input
                    checked={level.isExamYear}
                    className="h-4 w-4 cursor-pointer rounded text-teal-600 focus:ring-teal-500"
                    onChange={(event) => {
                      updateLevel(level.rowId, { isExamYear: event.target.checked });
                    }}
                    type="checkbox"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t('classes.levels.examYear')}
                  </span>
                </label>
                <button
                  aria-label={`${t('classes.levels.remove')} ${String(index + 1)}`}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  onClick={() => {
                    removeLevel(level.rowId);
                  }}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="pt-2">
              <button
                className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-teal-200 bg-teal-50/50 py-5 text-sm font-bold text-teal-700 transition-all hover:border-teal-300 hover:bg-teal-50"
                onClick={addLevel}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 transition-transform group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('classes.levels.add')}
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  setDraft(toDraft(setupState.classLevels));
                  setIsEditing(false);
                  setErrorKey(null);
                }}
                type="button"
              >
                {t('classes.cancel')}
              </button>
              <button
                className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  void handleSave();
                }}
                type="button"
              >
                {isSaving ? t('classes.saving') : t('classes.save')}
              </button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {setupState.classLevels.map((level) => {
              const classroomCount = perLevelCounts[level.id] ?? 0;
              return (
                <li
                  className="group flex items-center gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  key={level.id}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-black transition-colors ${
                      level.isExamYear
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200/80 group-hover:bg-slate-100'
                    }`}
                  >
                    {level.displayOrder}
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-700 transition-colors group-hover:text-slate-900">
                    {level.name}
                  </span>
                  {classroomCount > 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {t('classes.levels.classroomCount', { count: classroomCount })}
                    </span>
                  ) : null}
                  {level.isExamYear ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 ring-1 ring-inset ring-amber-200/60">
                      {t('classes.levels.examBadge')}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {saved ? (
        <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-700 shadow-sm">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-teal-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('classes.levels.saved')}
        </div>
      ) : null}
    </div>
  );
}

function toDraft(levels: SetupStateResponse['classLevels']): DraftLevel[] {
  return levels.map((level) => ({
    code: level.code,
    name: level.name,
    displayOrder: level.displayOrder,
    isExamYear: level.isExamYear,
    rowId: level.id,
  }));
}

const SUMMARY_TONES = {
  teal: { wrapper: 'hover:border-teal-200', glow: 'bg-teal-400' },
  indigo: { wrapper: 'hover:border-indigo-200', glow: 'bg-indigo-400' },
  amber: { wrapper: 'hover:border-amber-200', glow: 'bg-amber-400' },
} as const;

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: keyof typeof SUMMARY_TONES;
  value: number;
}) {
  const palette = SUMMARY_TONES[tone];

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] ${palette.wrapper}`}
    >
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10 ${palette.glow}`}
      />
      <p className="relative text-[11px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="relative mt-6 text-[40px] font-black tabular-nums leading-none tracking-tighter text-slate-900">
        {value}
      </p>
    </div>
  );
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}
