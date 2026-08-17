import type { LevelCurriculumsResponse, SubjectResponse } from '@edutrack/shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName } from '../people/ui';
import type { ClassesClient } from './useClassesState';
import {
  listLevelCurriculums,
  listSubjects,
  saveLevelCurriculum,
  type ClassesRequestOptions,
} from './classesApi';
import { resolveClassesErrorMessageKey } from './classesErrors';

/**
 * Level-scope curriculum matrix (roadmap §9.5): coefficients and
 * required/optional flags defined once per level and inherited by every
 * classroom of that level. The per-class operational records (class_subject,
 * teacher assignment) stay separate.
 */
export function LevelCurriculumView({
  apiBaseUrl,
  capabilityToken,
  client,
  onSessionExpired,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
  onSessionExpired?: () => void;
}) {
  const { t } = useTranslation();
  const requestOptions = useCallback(
    (): ClassesRequestOptions => (capabilityToken ? { capabilityToken } : {}),
    [capabilityToken]
  );

  const [curriculums, setCurriculums] = useState<LevelCurriculumsResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { coefficient: number; isRequired: boolean }>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setIsLoading(true);
    setErrorKey(null);

    try {
      const [curriculumData, subjectPage] = await Promise.all([
        client?.listLevelCurriculums
          ? client.listLevelCurriculums(requestOptions())
          : listLevelCurriculums(apiBaseUrl ?? '', requestOptions()),
        client
          ? client.listSubjects({ limit: 100, offset: 0, status: 'active' }, requestOptions())
          : listSubjects(
              apiBaseUrl ?? '',
              { limit: 100, offset: 0, status: 'active' },
              requestOptions()
            ),
      ]);

      setCurriculums(curriculumData);
      setSubjects(subjectPage.items);

      const firstLevel = curriculumData.items[0];
      setSelectedLevelId((current) => current ?? firstLevel?.levelId ?? null);

      if (firstLevel) {
        setDraft(
          Object.fromEntries(
            firstLevel.entries.map((entry) => [
              entry.subjectId,
              { coefficient: entry.coefficient, isRequired: entry.isRequired },
            ])
          )
        );
      }
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveClassesErrorMessageKey(error));
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
  }, [load]);

  const selectLevel = (levelId: string) => {
    setSelectedLevelId(levelId);
    const next = curriculums?.items.find((item) => item.levelId === levelId);
    setDraft(
      next
        ? Object.fromEntries(
            next.entries.map((entry) => [
              entry.subjectId,
              { coefficient: entry.coefficient, isRequired: entry.isRequired },
            ])
          )
        : {}
    );
    setSaved(false);
  };

  const toggleSubject = (subjectId: string) => {
    setDraft((current) => {
      if (current[subjectId]) {
        return Object.fromEntries(Object.entries(current).filter(([id]) => id !== subjectId));
      }

      return { ...current, [subjectId]: { coefficient: 1, isRequired: true } };
    });
    setSaved(false);
  };

  const updateCoefficient = (subjectId: string, value: string) => {
    const coefficient = Number.parseInt(value, 10);
    if (Number.isNaN(coefficient) || coefficient < 1 || coefficient > 20) {
      return;
    }

    setDraft((current) => {
      const existing = current[subjectId];
      if (!existing) {
        return current;
      }

      return { ...current, [subjectId]: { ...existing, coefficient } };
    });
    setSaved(false);
  };

  const toggleRequired = (subjectId: string) => {
    setDraft((current) => {
      const existing = current[subjectId];
      if (!existing) {
        return current;
      }

      return { ...current, [subjectId]: { ...existing, isRequired: !existing.isRequired } };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedLevelId) {
      setErrorKey('classes.errors.localService');
      return;
    }

    setIsSaving(true);
    setErrorKey(null);
    setSaved(false);

    try {
      const entries = Object.entries(draft).map(([subjectId, entry]) => ({
        subjectId,
        coefficient: entry.coefficient,
        isRequired: entry.isRequired,
      }));

      const data = client?.saveLevelCurriculum
        ? await client.saveLevelCurriculum({ levelId: selectedLevelId, entries }, requestOptions())
        : await saveLevelCurriculum(
            apiBaseUrl ?? '',
            { levelId: selectedLevelId, entries },
            requestOptions()
          );
      setCurriculums(data);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveClassesErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !curriculums) {
    return (
      <div className="flex h-40 items-center justify-center" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
      </div>
    );
  }

  const levelOptions = curriculums?.items ?? [];

  return (
    <div className="space-y-5">
      {errorKey ? (
        <div
          aria-live="polite"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
          role="alert"
        >
          {t(errorKey)}
        </div>
      ) : null}

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <SummaryStat
          label={t('classes.curriculumLevel.summary.levels')}
          tone="teal"
          value={levelOptions.length}
        />
        <SummaryStat
          label={t('classes.curriculumLevel.summary.subjects')}
          tone="indigo"
          value={subjects.length}
        />
        <SummaryStat
          label={t('classes.curriculumLevel.summary.mapped')}
          tone="amber"
          value={Object.keys(draft).length}
        />
      </div>

      <section className="rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-900">
              {t('classes.curriculumLevel.title')}
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('classes.curriculumLevel.hint')}
            </p>
          </div>

          {levelOptions.length > 1 && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs font-semibold text-slate-500 sm:inline-block">
                {t('classes.curriculumLevel.copyFrom')}
              </span>
              <select
                aria-label={t('classes.curriculumLevel.copyFrom')}
                className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                defaultValue=""
                onChange={(event) => {
                  const sourceLevelId = event.target.value;
                  if (!sourceLevelId) return;
                  const source = curriculums?.items.find((item) => item.levelId === sourceLevelId);
                  if (source) {
                    setDraft(
                      Object.fromEntries(
                        source.entries.map((entry) => [
                          entry.subjectId,
                          { coefficient: entry.coefficient, isRequired: entry.isRequired },
                        ])
                      )
                    );
                    setSaved(false);
                    // Reset select after copy
                    event.target.value = '';
                  }
                }}
              >
                <option disabled value="">Sélectionner un niveau...</option>
                {levelOptions
                  .filter((l) => l.levelId !== selectedLevelId && l.entries.length > 0)
                  .map((item) => (
                    <option key={item.levelId} value={item.levelId}>
                      {item.levelName}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {levelOptions.map((item) => {
            const isSelected = item.levelId === selectedLevelId;
            const hasCurriculum = item.entries.length > 0;
            
            return (
              <button
                key={item.levelId}
                className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  isSelected
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                onClick={() => selectLevel(item.levelId)}
                type="button"
              >
                {item.levelName}
                {hasCurriculum && (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSelected ? 'bg-teal-400' : 'bg-teal-500'
                    }`}
                    title="Programme configuré"
                  />
                )}
              </button>
            );
          })}
        </div>

        {levelOptions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
            <p className="text-sm font-black text-slate-500">
              {t('classes.curriculumLevel.noLevels')}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('classes.curriculumLevel.noLevelsHint')}
            </p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
            <p className="text-sm font-black text-slate-500">
              {t('classes.curriculumLevel.noSubjects')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3" scope="col">
                      {t('classes.curriculumLevel.subject')}
                    </th>
                    <th className="w-28 px-4 py-3" scope="col">
                      {t('classes.curriculumLevel.coefficient')}
                    </th>
                    <th className="w-40 px-4 py-3" scope="col">
                      {t('classes.curriculumLevel.type')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subjectItem) => {
                    const entry = draft[subjectItem.id];

                    return (
                      <tr
                        className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${
                          entry ? 'bg-teal-50/30' : ''
                        }`}
                        key={subjectItem.id}
                      >
                        <td className="px-4 py-3">
                          <label className="flex cursor-pointer items-center gap-3">
                            <input
                              checked={Boolean(entry)}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              onChange={() => {
                                toggleSubject(subjectItem.id);
                              }}
                              type="checkbox"
                            />
                            <span>
                              <span className="block text-[13px] font-bold text-slate-800">
                                {subjectItem.name}
                              </span>
                              <span className="block text-[11px] font-semibold text-slate-400">
                                {subjectItem.code}
                              </span>
                            </span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            aria-label={t('classes.curriculumLevel.coefficient')}
                            className={`${formInputClassName} h-11 w-20 rounded-xl text-center text-sm font-black`}
                            disabled={!entry}
                            max={20}
                            min={1}
                            onChange={(event) => {
                              updateCoefficient(subjectItem.id, event.target.value);
                            }}
                            type="number"
                            value={entry?.coefficient ?? ''}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {entry ? (
                            <button
                              className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
                                entry.isRequired
                                  ? 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 hover:bg-teal-100'
                                  : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-200'
                              }`}
                              onClick={() => {
                                toggleRequired(subjectItem.id);
                              }}
                              type="button"
                            >
                              {entry.isRequired
                                ? t('classes.curriculumLevel.required')
                                : t('classes.curriculumLevel.optional')}
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <p className="mr-auto text-[11px] font-semibold text-slate-400">
                {t('classes.curriculumLevel.inheritHint')}
              </p>
              <button
                className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving || !selectedLevelId}
                onClick={() => {
                  void handleSave();
                }}
                type="button"
              >
                {isSaving ? t('classes.saving') : t('classes.save')}
              </button>
            </div>
          </>
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
          {t('classes.curriculumLevel.saved')}
        </div>
      ) : null}
    </div>
  );
}

const SUMMARY_TONES = {
  teal: { glow: 'bg-teal-400' },
  indigo: { glow: 'bg-indigo-400' },
  amber: { glow: 'bg-amber-400' },
} as const;

function SummaryStat({
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
    <div className="relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
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
