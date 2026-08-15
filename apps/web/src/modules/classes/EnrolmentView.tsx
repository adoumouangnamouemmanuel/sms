import type {
  ClassroomView,
  SetupStateResponse,
  StudentsMissingClassResponse,
} from '@edutrack/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formSelectClassName } from '../people/ui';
import {
  enrolStudents,
  listClassrooms,
  listStudentsMissingClass,
  type ClassesRequestOptions,
} from './classesApi';
import { resolveClassesErrorMessageKey } from './classesErrors';
import type { ClassesClient } from './useClassesState';

export interface EnrolmentViewProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
  setupState: SetupStateResponse;
  onSessionExpired?: () => void;
}

export function EnrolmentView({
  apiBaseUrl,
  capabilityToken,
  client,
  onSessionExpired,
}: EnrolmentViewProps) {
  const { t } = useTranslation();
  const requestOptions = useCallback(
    (): ClassesRequestOptions => (capabilityToken ? { capabilityToken } : {}),
    [capabilityToken]
  );

  const [missing, setMissing] = useState<StudentsMissingClassResponse | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomView[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const loadAll = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setIsLoading(true);
    setErrorKey(null);

    try {
      const [missingResponse, classroomsResponse] = await Promise.all([
        client
          ? client.listStudentsMissingClass(requestOptions())
          : listStudentsMissingClass(apiBaseUrl ?? '', requestOptions()),
        client
          ? client.listClassrooms({ limit: 100, offset: 0 }, requestOptions())
          : listClassrooms(apiBaseUrl ?? '', { limit: 100, offset: 0 }, requestOptions()),
      ]);
      setMissing(missingResponse);
      setClassrooms(classroomsResponse.items);
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
      void loadAll();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [loadAll]);

  const toggle = (studentId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleEnrol = async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    if (!classroomId || selected.size === 0) {
      return;
    }

    setIsEnrolling(true);
    setErrorKey(null);
    setResult(null);

    try {
      const response = client
        ? await client.enrolStudents({ classroomId, studentIds: [...selected] }, requestOptions())
        : await enrolStudents(
            apiBaseUrl ?? '',
            { classroomId, studentIds: [...selected] },
            requestOptions()
          );
      setResult({
        imported: response.imported,
        skipped: response.skipped.length,
      });
      setSelected(new Set());
      await loadAll();
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }
      setErrorKey(resolveClassesErrorMessageKey(error));
    } finally {
      setIsEnrolling(false);
    }
  };

  const classroomOptions = useMemo(
    () =>
      classrooms
        .filter((item) => item.classroom.isActive)
        .sort((a, b) => a.classLevelName.localeCompare(b.classLevelName)),
    [classrooms]
  );

  const stats = useMemo(() => {
    const withCapacity = classroomOptions.filter((item) => item.classroom.capacity !== null);
    const seatsLeft = withCapacity.reduce(
      (sum, item) => sum + Math.max(0, (item.classroom.capacity ?? 0) - item.activeEnrollmentCount),
      0
    );
    const totalSeats = withCapacity.reduce((sum, item) => sum + (item.classroom.capacity ?? 0), 0);
    return {
      missingCount: missing?.total ?? 0,
      classroomCount: classroomOptions.length,
      seatsLeft,
      totalSeats,
    };
  }, [classroomOptions, missing]);

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

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <SummaryCard
          label={t('classes.enrolment.stats.missing')}
          tone="rose"
          value={stats.missingCount}
        />
        <SummaryCard
          label={t('classes.enrolment.stats.classes')}
          tone="teal"
          value={stats.classroomCount}
        />
        <SummaryCard
          label={t('classes.enrolment.stats.seats')}
          tone="indigo"
          value={stats.seatsLeft}
          {...(stats.totalSeats > 0
            ? {
                footnote: t('classes.enrolment.stats.seatsHint', {
                  percent: Math.round((stats.seatsLeft / stats.totalSeats) * 100),
                }),
              }
            : {})}
        />
      </div>

      {/* Bulk enrolment */}
      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-900">
              {t('classes.enrolment.bulkTitle')}
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {missing
                ? t('classes.enrolment.bulkHintYear', {
                    year: missing.academicYearLabel,
                  })
                : t('classes.enrolment.bulkHint')}
            </p>
          </div>
          {missing && missing.total > 0 ? (
            <button
              className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400"
              onClick={() => {
                setSelected(new Set(missing.students.map((student) => student.id)));
              }}
              type="button"
            >
              {t('classes.enrolment.selectAll', { count: missing.total })}
            </button>
          ) : null}
        </div>

        {isLoading && !missing ? (
          <p className="py-10 text-center text-sm font-bold text-slate-400">
            {t('classes.loading')}
          </p>
        ) : missing?.students.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-teal-200 bg-teal-50/40 py-14 text-center">
            <p className="text-sm font-bold text-teal-700">{t('classes.enrolment.noneMissing')}</p>
          </div>
        ) : (
          <>
            <div className="mt-5 max-h-80 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
              {missing?.students.map((student) => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-teal-200"
                  key={student.id}
                >
                  <input
                    checked={selected.has(student.id)}
                    className="h-4 w-4 cursor-pointer rounded text-teal-600 focus:ring-teal-500"
                    onChange={() => {
                      toggle(student.id);
                    }}
                    type="checkbox"
                  />
                  <span className="flex-1 text-[13px] font-bold text-slate-700">
                    {student.lastName} {student.firstName}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-400">
                    {student.code}
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-slate-600">
                    {t('classes.enrolment.targetClass')} *
                  </span>
                  <select
                    className={`${formSelectClassName} h-11 min-w-[220px]`}
                    onChange={(event) => {
                      setClassroomId(event.target.value);
                      setResult(null);
                    }}
                    value={classroomId}
                  >
                    <option value="">{t('classes.enrolment.chooseClass')}</option>
                    {classroomOptions.map((item) => (
                      <option key={item.classroom.id} value={item.classroom.id}>
                        {item.classLevelName} {item.classroom.code} —{' '}
                        {t('classes.enrolment.classEffectif', {
                          count: item.activeEnrollmentCount,
                        })}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isEnrolling || selected.size === 0}
                  onClick={() => {
                    void handleEnrol();
                  }}
                  type="button"
                >
                  {isEnrolling
                    ? t('classes.enrolment.enrolling')
                    : t('classes.enrolment.enrolConfirm')}
                </button>
              </div>
              <p className="text-[12px] font-bold text-slate-400">
                {t('classes.enrolment.selected', { count: selected.size })}
              </p>
            </div>

            {result ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-3">
                <span className="inline-flex rounded-full border border-teal-300/60 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-700">
                  {t('classes.enrolment.imported', { count: result.imported })}
                </span>
                {result.skipped > 0 ? (
                  <span className="inline-flex rounded-full border border-amber-300/60 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {t('classes.enrolment.skipped', { count: result.skipped })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Classrooms quick overview */}
      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <h3 className="mb-5 text-base font-black tracking-tight text-slate-900">
          {t('classes.enrolment.classroomsTitle')}
        </h3>
        {classroomOptions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 py-12 text-center">
            <p className="text-sm font-bold text-slate-400">
              {t('classes.enrolment.noClassrooms')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classroomOptions.map((item) => {
              const { classroom } = item;
              const ratio =
                classroom.capacity !== null && classroom.capacity > 0
                  ? Math.min(1, item.activeEnrollmentCount / classroom.capacity)
                  : null;
              return (
                <button
                  className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300/70 hover:shadow-[0_10px_30px_-8px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  key={classroom.id}
                  onClick={() => {
                    setClassroomId(classroom.id);
                  }}
                  type="button"
                >
                  <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  </div>
                  <p className="pr-8 text-[15px] font-black tracking-tight text-slate-900">
                    {item.classLevelName} {classroom.code}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {t('classes.enrolment.classEffectif', {
                        count: item.activeEnrollmentCount,
                      })}
                    </span>
                    {classroom.capacity !== null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        {t('classes.enrolment.capacity', {
                          capacity: classroom.capacity,
                        })}
                      </span>
                    ) : null}
                    {ratio !== null && ratio >= 0.9 ? (
                      <span
                        aria-label={t('classes.enrolment.full')}
                        className="inline-flex h-2 w-2 rounded-full bg-red-400"
                        title={t('classes.enrolment.full')}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="px-1 text-[11px] font-semibold leading-relaxed text-slate-400">
        {t('classes.enrolment.rule')}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const SUMMARY_TONES = {
  rose: {
    wrapper: 'hover:border-rose-200',
    glow: 'bg-rose-400',
    number: 'text-slate-900',
  },
  teal: {
    wrapper: 'hover:border-teal-200',
    glow: 'bg-teal-400',
    number: 'text-slate-900',
  },
  indigo: {
    wrapper: 'hover:border-indigo-200',
    glow: 'bg-indigo-400',
    number: 'text-slate-900',
  },
} as const;

function SummaryCard({
  label,
  footnote,
  tone,
  value,
}: {
  label: string;
  footnote?: string;
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
      <p
        className={`relative mt-6 text-[40px] font-black tabular-nums leading-none tracking-tighter ${palette.number}`}
      >
        {value}
      </p>
      {footnote ? (
        <p className="relative mt-3 text-[11px] font-bold text-slate-400">{footnote}</p>
      ) : null}
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
