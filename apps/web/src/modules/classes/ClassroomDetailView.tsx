import type {
  AssignClassSubjectRequest,
  ClassroomRosterResponse,
  ClassroomView,
  ClassSubjectView,
  CurriculumCopyPreviewRequest,
  CurriculumCopyPreviewResponse,
  EnrolStudentsResponse,
  SubjectResponse,
  TransferStudentRequest,
} from '@edutrack/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportModal } from '../imports';
import {
  ArchiveDialog,
  ModalCancelButton,
  ModalShell,
  StatusBadge,
  formInputClassName,
  formSelectClassName,
} from '../people/ui';
import {
  assignClassSubject,
  confirmCurriculumCopy,
  enrolOptionalSubjects,
  enrolStudents,
  exportClassRegister,
  getClassroomRoster,
  listClassSubjects,
  listStudentsMissingClass,
  previewCurriculumCopy,
  transferStudent,
  updateClassSubject,
  type ClassesRequestOptions,
} from './classesApi';
import { resolveClassesErrorMessageKey } from './classesErrors';
import type { ClassesClient } from './useClassesState';

export interface ClassroomDetailViewProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
  classroom: ClassroomView;
  onSessionExpired?: () => void;
  onBack: () => void;
}

export interface DetailApi {
  roster(classroomId: string, options?: ClassesRequestOptions): Promise<ClassroomRosterResponse>;
  classSubjects(classroomId: string, options?: ClassesRequestOptions): Promise<ClassSubjectView[]>;
  enrol(
    input: { classroomId: string; studentIds: string[] },
    options?: ClassesRequestOptions
  ): Promise<EnrolStudentsResponse>;
  transfer(
    studentId: string,
    input: TransferStudentRequest,
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  optional(
    input: { classroomId: string; studentId: string; classSubjectIds: string[] },
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  copyPreview(
    input: CurriculumCopyPreviewRequest,
    options?: ClassesRequestOptions
  ): Promise<CurriculumCopyPreviewResponse>;
  copyConfirm(
    input: CurriculumCopyPreviewRequest,
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  assign(
    input: AssignClassSubjectRequest,
    options?: ClassesRequestOptions
  ): Promise<ClassSubjectView>;
  updateAssignment(
    id: string,
    input: Parameters<typeof updateClassSubject>[2],
    options?: ClassesRequestOptions
  ): Promise<ClassSubjectView>;
  exportRegister(
    classroomId: string,
    options?: ClassesRequestOptions
  ): Promise<{ content: string; filename: string }>;
  missingClass(options?: ClassesRequestOptions): Promise<{
    students: { id: string; code: string; firstName: string; lastName: string }[];
    total: number;
  }>;
  subjects(options?: ClassesRequestOptions): Promise<SubjectResponse[]>;
  classrooms(options?: ClassesRequestOptions): Promise<ClassroomView[]>;
  archive(
    classroomId: string,
    input: { reason: string },
    options?: ClassesRequestOptions
  ): Promise<unknown>;
  reactivate(
    classroomId: string,
    input: { reason: string },
    options?: ClassesRequestOptions
  ): Promise<unknown>;
}

export function ClassroomDetailView({
  apiBaseUrl,
  capabilityToken,
  client,
  classroom,
  onSessionExpired,
  onBack,
}: ClassroomDetailViewProps) {
  const { t } = useTranslation();
  const api = useDetailApi(apiBaseUrl, client);
  const [roster, setRoster] = useState<ClassroomRosterResponse | null>(null);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ studentId: string; name: string } | null>(
    null
  );
  const [optionalTarget, setOptionalTarget] = useState<{ studentId: string; name: string } | null>(
    null
  );
  const [copyOpen, setCopyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const requestOptions = useCallback(
    (): ClassesRequestOptions => (capabilityToken ? { capabilityToken } : {}),
    [capabilityToken]
  );

  const loadAll = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setLoading(true);
    setErrorKey(null);

    try {
      const [nextRoster, nextSubjects] = await Promise.all([
        api.roster(classroom.classroom.id, requestOptions()),
        api.classSubjects(classroom.classroom.id, requestOptions()),
      ]);
      setRoster(nextRoster);
      setClassSubjects(nextSubjects);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }
      setErrorKey(resolveClassesErrorMessageKey(error));
    } finally {
      setLoading(false);
    }
  }, [api, apiBaseUrl, client, classroom.classroom.id, onSessionExpired, requestOptions]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [loadAll]);

  const classroomLabel = `${classroom.classLevelName} ${classroom.classroom.code}`;
  const ratio =
    roster && roster.capacity !== null && roster.capacity > 0
      ? Math.min(1, roster.enrolledCount / roster.capacity)
      : null;

  const handleExport = async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setExporting(true);
    setErrorKey(null);

    try {
      const result = await api.exportRegister(classroom.classroom.id, requestOptions());
      const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }
      setErrorKey(resolveClassesErrorMessageKey(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            aria-label={t('classes.back')}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={onBack}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path d="M19 12H5m6 6-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{classroomLabel}</h2>
            <p className="text-[12px] font-semibold text-slate-400">
              {classroom.academicYearLabel}
              {classroom.classroom.name ? ` · ${classroom.classroom.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 hover:border-red-300 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setArchiveOpen(true);
            }}
            type="button"
          >
            {classroom.classroom.isActive ? t('classes.archive') : t('classes.reactivate')}
          </button>
          <button
            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={exporting}
            onClick={() => {
              void handleExport();
            }}
            type="button"
          >
            {exporting ? t('classes.exporting') : t('classes.classrooms.exportRegister')}
          </button>
          <button
            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              setCopyOpen(true);
            }}
            type="button"
          >
            {t('classes.classrooms.copyCurriculum')}
          </button>
          <button
            className="h-10 cursor-pointer rounded-xl bg-teal-500 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              setEnrolOpen(true);
            }}
            type="button"
          >
            {t('classes.classrooms.enrolStudents')}
          </button>
        </div>
      </div>

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

      {loading ? (
        <p className="py-10 text-center text-sm font-bold text-slate-400">{t('classes.loading')}</p>
      ) : (
        <>
          {/* Roster + capacity */}
          <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-black tracking-tight text-slate-900">
                {t('classes.roster.title')}
              </h3>
              {roster ? (
                <div className="flex items-center gap-4">
                  <span className="text-[12px] font-bold text-slate-500">
                    {roster.capacity !== null
                      ? t('classes.roster.capacity', {
                          count: roster.enrolledCount,
                          capacity: roster.capacity,
                        })
                      : t('classes.roster.count', { count: roster.enrolledCount })}
                  </span>
                  {ratio !== null ? (
                    <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={`block h-full rounded-full ${
                          ratio >= 1 ? 'bg-red-400' : ratio >= 0.85 ? 'bg-amber-400' : 'bg-teal-400'
                        }`}
                        style={{ width: `${String(Math.round(ratio * 100))}%` }}
                      />
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {roster?.entries.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 py-12 text-center">
                <p className="text-sm font-bold text-slate-400">{t('classes.roster.empty')}</p>
                <button
                  className="mt-3 cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
                  onClick={() => {
                    setEnrolOpen(true);
                  }}
                  type="button"
                >
                  {t('classes.classrooms.enrolStudents')}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2.5">{t('classes.roster.code')}</th>
                      <th className="px-3 py-2.5">{t('classes.roster.name')}</th>
                      <th className="px-3 py-2.5">{t('classes.roster.sex')}</th>
                      <th className="px-3 py-2.5">{t('classes.roster.birth')}</th>
                      <th className="px-3 py-2.5 text-right">{t('classes.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster?.entries.map((entry) => (
                      <tr
                        className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                        key={entry.enrollment.id}
                      >
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[12px] font-bold text-slate-700">
                            {entry.student.code}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[13px] font-bold text-slate-800">
                          {entry.student.lastName} {entry.student.firstName}
                        </td>
                        <td className="px-3 py-3 text-[12px] font-bold text-slate-500">
                          {entry.student.sex ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-slate-500">
                          {entry.student.dateOfBirth ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => {
                                setOptionalTarget({
                                  studentId: entry.student.id,
                                  name: `${entry.student.lastName} ${entry.student.firstName}`,
                                });
                              }}
                              type="button"
                            >
                              {t('classes.roster.options')}
                            </button>
                            <button
                              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-indigo-500 hover:bg-indigo-50"
                              onClick={() => {
                                setTransferTarget({
                                  studentId: entry.student.id,
                                  name: `${entry.student.lastName} ${entry.student.firstName}`,
                                });
                              }}
                              type="button"
                            >
                              {t('classes.roster.transfer')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Curriculum */}
          <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-900">
                  {t('classes.curriculum.title')}
                </h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-400">
                  {t('classes.curriculum.hint')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
                  onClick={() => {
                    setImportOpen(true);
                  }}
                  type="button"
                >
                  {t('imports.action')}
                </button>
                <button
                  className="h-9 cursor-pointer rounded-xl bg-teal-500 px-3 text-[12px] font-bold text-white shadow-sm hover:bg-teal-400"
                  onClick={() => {
                    setAssignOpen(true);
                  }}
                  type="button"
                >
                  {t('classes.curriculum.assign')}
                </button>
              </div>
            </div>

            {classSubjects.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 py-12 text-center">
                <p className="text-sm font-bold text-slate-400">{t('classes.curriculum.empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2.5">{t('classes.curriculum.subject')}</th>
                      <th className="px-3 py-2.5">{t('classes.curriculum.coefficient')}</th>
                      <th className="px-3 py-2.5">{t('classes.curriculum.kind')}</th>
                      <th className="px-3 py-2.5">{t('classes.curriculum.teacher')}</th>
                      <th className="px-3 py-2.5 text-right">{t('classes.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classSubjects.map((view) => (
                      <ClassSubjectRow
                        key={view.classSubject.id}
                        onRemoved={async () => {
                          if (!apiBaseUrl && !client) return;
                          if (client) {
                            await client.removeClassSubject(view.classSubject.id);
                          } else {
                            await removeClassSubjectPublic(
                              apiBaseUrl ?? '',
                              view.classSubject.id,
                              requestOptions()
                            );
                          }
                          await loadAll();
                        }}
                        onUpdated={async (coefficient) => {
                          await api.updateAssignment(
                            view.classSubject.id,
                            { coefficient, recordVersion: view.classSubject.recordVersion },
                            requestOptions()
                          );
                          await loadAll();
                        }}
                        view={view}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {assignOpen ? (
        <AssignSubjectModal
          api={api}
          classroomId={classroom.classroom.id}
          requestOptions={requestOptions()}
          onClose={() => {
            setAssignOpen(false);
          }}
          onSubmit={async (input) => {
            await api.assign(input, requestOptions());
            setAssignOpen(false);
            await loadAll();
          }}
        />
      ) : null}

      {enrolOpen ? (
        <EnrolStudentsModal
          api={api}
          classroomId={classroom.classroom.id}
          requestOptions={requestOptions()}
          onClose={() => {
            setEnrolOpen(false);
          }}
          onSubmit={async (studentIds) => {
            await api.enrol({ classroomId: classroom.classroom.id, studentIds }, requestOptions());
            setEnrolOpen(false);
            await loadAll();
          }}
        />
      ) : null}

      {transferTarget ? (
        <TransferModal
          api={api}
          requestOptions={requestOptions()}
          studentId={transferTarget.studentId}
          studentName={transferTarget.name}
          onClose={() => {
            setTransferTarget(null);
          }}
          onSubmit={async (input) => {
            await api.transfer(transferTarget.studentId, input, requestOptions());
            setTransferTarget(null);
            await loadAll();
          }}
        />
      ) : null}

      {optionalTarget ? (
        <OptionalSubjectsModal
          classSubjects={classSubjects}
          classroomId={classroom.classroom.id}
          studentId={optionalTarget.studentId}
          studentName={optionalTarget.name}
          onClose={() => {
            setOptionalTarget(null);
          }}
          onSubmit={async (classSubjectIds) => {
            await api.optional(
              {
                classroomId: classroom.classroom.id,
                studentId: optionalTarget.studentId,
                classSubjectIds,
              },
              requestOptions()
            );
            setOptionalTarget(null);
          }}
        />
      ) : null}

      {copyOpen ? (
        <CopyCurriculumModal
          api={api}
          requestOptions={requestOptions()}
          sourceClassroomId={classroom.classroom.id}
          sourceLabel={classroomLabel}
          onClose={() => {
            setCopyOpen(false);
          }}
          onConfirmed={() => {
            void loadAll();
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportModal
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          kind="CLASS_SUBJECTS"
          {...(onSessionExpired ? { onSessionExpired } : {})}
          onClose={() => {
            setImportOpen(false);
            void loadAll();
          }}
        />
      ) : null}

      {archiveOpen ? (
        <ArchiveDialog
          labels={{
            title: t(
              classroom.classroom.isActive
                ? 'classes.classrooms.archiveTitle'
                : 'classes.classrooms.reactivateTitle',
              { code: classroom.classroom.code }
            ),
            body: t(
              classroom.classroom.isActive
                ? 'classes.classrooms.archiveBody'
                : 'classes.classrooms.reactivateBody',
              { code: classroom.classroom.code }
            ),
            reasonLabel: t('classes.archiveReasonLabel'),
            reasonPlaceholder: t('classes.archiveReasonPlaceholder'),
            reasonRequiredMessage: t('classes.archiveReasonRequired'),
            confirmLabel: t(
              classroom.classroom.isActive ? 'classes.archive' : 'classes.reactivate'
            ),
            cancelLabel: t('classes.cancel'),
          }}
          onClose={() => {
            setArchiveOpen(false);
          }}
          onConfirm={async (reason) => {
            if (classroom.classroom.isActive) {
              await api.archive(classroom.classroom.id, { reason }, requestOptions());
            } else {
              await api.reactivate(classroom.classroom.id, { reason }, requestOptions());
            }
            setArchiveOpen(false);
            onBack();
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useDetailApi — routes through the injected client when present, else the API
// ---------------------------------------------------------------------------

function useDetailApi(apiBaseUrl: string | null, client?: ClassesClient): DetailApi {
  // Memoized so the detail view's load effect stays stable across renders.
  return useMemo(
    () => ({
      roster: (classroomId, options) =>
        client
          ? client.getClassroomRoster(classroomId, options)
          : getClassroomRoster(apiBaseUrl ?? '', classroomId, options),
      classSubjects: (classroomId, options) =>
        client
          ? client.listClassSubjects(classroomId, options)
          : listClassSubjects(apiBaseUrl ?? '', classroomId, options),
      enrol: (input, options) =>
        client
          ? client.enrolStudents(input, options)
          : enrolStudents(apiBaseUrl ?? '', input, options),
      transfer: (studentId, input, options) =>
        client
          ? client.transferStudent(studentId, input, options)
          : transferStudent(apiBaseUrl ?? '', studentId, input, options),
      optional: (input, options) =>
        client
          ? client.enrolOptionalSubjects(input, options)
          : enrolOptionalSubjects(apiBaseUrl ?? '', input, options),
      copyPreview: (input, options) =>
        client
          ? client.previewCurriculumCopy(input, options)
          : previewCurriculumCopy(apiBaseUrl ?? '', input, options),
      copyConfirm: (input, options) =>
        client
          ? client.confirmCurriculumCopy(input, options)
          : confirmCurriculumCopy(apiBaseUrl ?? '', input, options),
      assign: (input, options) =>
        client
          ? client.assignClassSubject(input, options)
          : assignClassSubject(apiBaseUrl ?? '', input, options),
      updateAssignment: (id, input, options) =>
        client
          ? client.updateClassSubject(id, input, options)
          : updateClassSubject(apiBaseUrl ?? '', id, input, options),
      exportRegister: (classroomId, options) =>
        client
          ? client.exportRegister(classroomId, options)
          : exportClassRegister(apiBaseUrl ?? '', classroomId, options),
      missingClass: (options) =>
        client
          ? client.listStudentsMissingClass(options)
          : listStudentsMissingClass(apiBaseUrl ?? '', options),
      subjects: async (options) => {
        if (client) {
          return (await client.listSubjects({ limit: 100, offset: 0 }, options)).items;
        }
        const { listSubjects } = await import('./classesApi');
        return (await listSubjects(apiBaseUrl ?? '', { limit: 100, offset: 0 }, options)).items;
      },
      classrooms: async (options) => {
        if (client) {
          return (await client.listClassrooms({ limit: 100, offset: 0 }, options)).items;
        }
        const { listClassrooms } = await import('./classesApi');
        return (await listClassrooms(apiBaseUrl ?? '', { limit: 100, offset: 0 }, options)).items;
      },
      archive: (classroomId, input, options) =>
        client
          ? client.archiveClassroom(classroomId, input, options)
          : (async () => {
              const { archiveClassroom } = await import('./classesApi');
              return archiveClassroom(apiBaseUrl ?? '', classroomId, input, options);
            })(),
      reactivate: (classroomId, input, options) =>
        client
          ? client.reactivateClassroom(classroomId, input, options)
          : (async () => {
              const { reactivateClassroom } = await import('./classesApi');
              return reactivateClassroom(apiBaseUrl ?? '', classroomId, input, options);
            })(),
    }),
    [apiBaseUrl, client]
  );
}

async function removeClassSubjectPublic(
  apiBaseUrl: string,
  classSubjectId: string,
  options: ClassesRequestOptions
) {
  const { removeClassSubject } = await import('./classesApi');
  await removeClassSubject(apiBaseUrl, classSubjectId, options);
}

// ---------------------------------------------------------------------------
// ClassSubjectRow — inline coefficient edit + removal
// ---------------------------------------------------------------------------

function ClassSubjectRow({
  view,
  onRemoved,
  onUpdated,
}: {
  view: ClassSubjectView;
  onRemoved: () => Promise<void>;
  onUpdated: (coefficient: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [coefficient, setCoefficient] = useState(String(view.classSubject.coefficient));
  const [isBusy, setIsBusy] = useState(false);

  return (
    <tr className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
      <td className="px-3 py-3">
        <span className="text-[13px] font-bold text-slate-800">{view.subjectName}</span>
        <span className="ml-2 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500">
          {view.subjectCode}
        </span>
      </td>
      <td className="px-3 py-3">
        {editing ? (
          <input
            aria-label={t('classes.curriculum.coefficient')}
            className={`${formInputClassName} h-9 w-20`}
            max={20}
            min={1}
            onChange={(event) => {
              setCoefficient(event.target.value);
            }}
            type="number"
            value={coefficient}
          />
        ) : (
          <span className="inline-flex rounded-lg bg-teal-50 px-2.5 py-1 text-[13px] font-black text-teal-700">
            {view.classSubject.coefficient}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        {view.classSubject.isRequired ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/60 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            {t('classes.curriculum.required')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
            {t('classes.curriculum.optional')}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-[12px] font-semibold text-slate-500">
        {view.teacherName ?? '—'}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {editing ? (
            <>
              <button
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                disabled={isBusy || Number(coefficient) < 1 || Number(coefficient) > 20}
                onClick={() => {
                  setIsBusy(true);
                  void onUpdated(Number(coefficient)).finally(() => {
                    setIsBusy(false);
                    setEditing(false);
                  });
                }}
                type="button"
              >
                {t('classes.save')}
              </button>
              <button
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-400 hover:bg-slate-100"
                onClick={() => {
                  setEditing(false);
                  setCoefficient(String(view.classSubject.coefficient));
                }}
                type="button"
              >
                {t('classes.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={() => {
                  setEditing(true);
                }}
                type="button"
              >
                {t('classes.edit')}
              </button>
              <button
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-red-500 hover:bg-red-50"
                onClick={() => {
                  void onRemoved();
                }}
                type="button"
              >
                {t('classes.curriculum.remove')}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// AssignSubjectModal
// ---------------------------------------------------------------------------

function AssignSubjectModal({
  api,
  classroomId,
  requestOptions,
  onClose,
  onSubmit,
}: {
  api: DetailApi;
  classroomId: string;
  requestOptions: ClassesRequestOptions;
  onClose: () => void;
  onSubmit: (input: AssignClassSubjectRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [isRequired, setIsRequired] = useState(true);
  const [teacherId, setTeacherId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.subjects(requestOptions).then((items) => {
      if (!cancelled) {
        setSubjects(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, requestOptions]);

  const fieldClassName = `${formInputClassName} h-11`;
  const selectClassName = `${formSelectClassName} h-11`;

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      title={t('classes.curriculum.assignTitle')}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setIsSaving(true);
          void onSubmit({
            classroomId,
            subjectId,
            coefficient: Number(coefficient),
            isRequired,
            teacherId: teacherId || null,
          })
            .catch(() => undefined)
            .finally(() => {
              setIsSaving(false);
            });
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.curriculum.subject')} *
          </span>
          <select
            className={selectClassName}
            onChange={(event) => {
              setSubjectId(event.target.value);
            }}
            required
            value={subjectId}
          >
            <option value="">{t('classes.curriculum.chooseSubject')}</option>
            {subjects
              .filter((subject) => subject.isActive)
              .map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.curriculum.coefficient')} *
          </span>
          <input
            className={fieldClassName}
            max={20}
            min={1}
            onChange={(event) => {
              setCoefficient(event.target.value);
            }}
            required
            type="number"
            value={coefficient}
          />
        </label>
        <label className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
          <input
            checked={isRequired}
            className="h-4 w-4 cursor-pointer rounded text-teal-600 focus:ring-teal-500"
            onChange={(event) => {
              setIsRequired(event.target.checked);
            }}
            type="checkbox"
          />
          <span className="text-[13px] font-bold text-slate-700">
            {t('classes.curriculum.requiredLabel')}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.curriculum.teacher')}
          </span>
          <input
            className={fieldClassName}
            onChange={(event) => {
              setTeacherId(event.target.value);
            }}
            placeholder={t('classes.curriculum.teacherPlaceholder')}
            value={teacherId}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || !subjectId}
            type="submit"
          >
            {isSaving ? t('classes.saving') : t('classes.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// EnrolStudentsModal
// ---------------------------------------------------------------------------

function EnrolStudentsModal({
  api,
  classroomId,
  requestOptions,
  onClose,
  onSubmit,
}: {
  api: DetailApi;
  classroomId: string;
  requestOptions: ClassesRequestOptions;
  onClose: () => void;
  onSubmit: (studentIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [missing, setMissing] = useState<
    { id: string; code: string; firstName: string; lastName: string }[]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .missingClass(requestOptions)
      .then((response) => {
        if (!cancelled) {
          setMissing(response.students);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, requestOptions]);

  void classroomId;

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

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      size="lg"
      title={t('classes.roster.enrolTitle')}
    >
      <p className="mb-4 text-[13px] font-semibold leading-6 text-slate-500">
        {t('classes.roster.enrolHint')}
      </p>
      {missing.length === 0 ? (
        <p className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-[13px] font-bold text-teal-700">
          {t('classes.roster.noMissing')}
        </p>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          {missing.map((student) => (
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
              <span className="font-mono text-[11px] font-bold text-slate-400">{student.code}</span>
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[12px] font-bold text-slate-400">
          {t('classes.roster.selected', { count: selected.size })}
        </p>
        <div className="flex gap-2">
          <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || selected.size === 0}
            onClick={() => {
              setIsSaving(true);
              void onSubmit([...selected]).finally(() => {
                setIsSaving(false);
              });
            }}
            type="button"
          >
            {isSaving ? t('classes.saving') : t('classes.roster.enrolConfirm')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// TransferModal
// ---------------------------------------------------------------------------

function TransferModal({
  api,
  requestOptions,
  studentId,
  studentName,
  onClose,
  onSubmit,
}: {
  api: DetailApi;
  requestOptions: ClassesRequestOptions;
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSubmit: (input: TransferStudentRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [targetClassroomId, setTargetClassroomId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [classrooms, setClassrooms] = useState<ClassroomView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.classrooms(requestOptions).then((items) => {
      if (!cancelled) {
        setClassrooms(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, requestOptions]);

  void studentId;

  const selectClassName = `${formSelectClassName} h-11`;
  const fieldClassName = `${formInputClassName} h-11`;

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      title={t('classes.roster.transferTitle', { name: studentName })}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setIsSaving(true);
          void onSubmit({
            targetClassroomId,
            effectiveDate,
            reason: reason.trim(),
          })
            .catch(() => undefined)
            .finally(() => {
              setIsSaving(false);
            });
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.roster.targetClass')} *
          </span>
          <select
            className={selectClassName}
            onChange={(event) => {
              setTargetClassroomId(event.target.value);
            }}
            required
            value={targetClassroomId}
          >
            <option value="">{t('classes.roster.chooseTarget')}</option>
            {classrooms.map((item) => (
              <option key={item.classroom.id} value={item.classroom.id}>
                {item.classLevelName} {item.classroom.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.roster.effectiveDate')} *
          </span>
          <input
            className={fieldClassName}
            onChange={(event) => {
              setEffectiveDate(event.target.value);
            }}
            required
            type="date"
            value={effectiveDate}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.roster.reason')} *
          </span>
          <textarea
            className="min-h-[80px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder={t('classes.roster.reasonPlaceholder')}
            required
            value={reason}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? t('classes.saving') : t('classes.roster.transferConfirm')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// OptionalSubjectsModal
// ---------------------------------------------------------------------------

function OptionalSubjectsModal({
  classSubjects,
  classroomId,
  studentId,
  studentName,
  onClose,
  onSubmit,
}: {
  classSubjects: ClassSubjectView[];
  classroomId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSubmit: (classSubjectIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const optional = classSubjects.filter((view) => !view.classSubject.isRequired);

  void classroomId;
  void studentId;

  const toggle = (classSubjectId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(classSubjectId)) {
        next.delete(classSubjectId);
      } else {
        next.add(classSubjectId);
      }
      return next;
    });
  };

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      title={t('classes.roster.optionsTitle', { name: studentName })}
    >
      <p className="mb-4 text-[13px] font-semibold leading-6 text-slate-500">
        {t('classes.roster.optionsHint')}
      </p>
      {optional.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[13px] font-bold text-slate-500">
          {t('classes.roster.noOptional')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {optional.map((view) => (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-teal-200"
              key={view.classSubject.id}
            >
              <input
                checked={selected.has(view.classSubject.id)}
                className="h-4 w-4 cursor-pointer rounded text-teal-600 focus:ring-teal-500"
                onChange={() => {
                  toggle(view.classSubject.id);
                }}
                type="checkbox"
              />
              <span className="flex-1 text-[13px] font-bold text-slate-700">
                {view.subjectName}
              </span>
              <span className="text-[12px] font-bold text-slate-400">
                {t('classes.curriculum.coefficient')} {view.classSubject.coefficient}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
        <button
          className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || selected.size === 0}
          onClick={() => {
            setIsSaving(true);
            void onSubmit([...selected]).finally(() => {
              setIsSaving(false);
            });
          }}
          type="button"
        >
          {isSaving ? t('classes.saving') : t('classes.roster.enrolConfirm')}
        </button>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// CopyCurriculumModal — preview then confirm
// ---------------------------------------------------------------------------

function CopyCurriculumModal({
  api,
  requestOptions,
  sourceClassroomId,
  sourceLabel,
  onClose,
  onConfirmed,
}: {
  api: DetailApi;
  requestOptions: ClassesRequestOptions;
  sourceClassroomId: string;
  sourceLabel: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { t } = useTranslation();
  const [targetClassroomId, setTargetClassroomId] = useState('');
  const [preview, setPreview] = useState<CurriculumCopyPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.classrooms(requestOptions).then((items) => {
      if (!cancelled) {
        setClassrooms(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, requestOptions]);

  const selectClassName = `${formSelectClassName} h-11`;

  const loadPreview = async () => {
    if (!targetClassroomId) {
      return;
    }
    setIsLoading(true);
    setErrorKey(null);
    try {
      const next = await api.copyPreview({ sourceClassroomId, targetClassroomId }, requestOptions);
      setPreview(next);
    } catch (error) {
      setErrorKey(resolveClassesErrorMessageKey(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      size="lg"
      title={t('classes.curriculum.copyTitle')}
    >
      <p className="mb-4 text-[13px] font-semibold leading-6 text-slate-500">
        {t('classes.curriculum.copyHint', { source: sourceLabel })}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-slate-800">
          {t('classes.roster.targetClass')} *
        </span>
        <div className="flex gap-2">
          <select
            className={selectClassName}
            onChange={(event) => {
              setTargetClassroomId(event.target.value);
              setPreview(null);
            }}
            value={targetClassroomId}
          >
            <option value="">{t('classes.roster.chooseTarget')}</option>
            {classrooms
              .filter((item) => item.classroom.id !== sourceClassroomId)
              .map((item) => (
                <option key={item.classroom.id} value={item.classroom.id}>
                  {item.classLevelName} {item.classroom.code}
                </option>
              ))}
          </select>
          <button
            className="h-11 cursor-pointer whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!targetClassroomId || isLoading}
            onClick={() => {
              void loadPreview();
            }}
            type="button"
          >
            {isLoading ? t('classes.loading') : t('classes.curriculum.preview')}
          </button>
        </div>
      </label>

      {errorKey ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {t(errorKey)}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-teal-200/60 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
              {t('classes.curriculum.newCount', { count: preview.newCount })}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
              {t('classes.curriculum.skippedCount', { count: preview.skippedCount })}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-100">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2.5">{t('classes.curriculum.subject')}</th>
                  <th className="px-3 py-2.5">{t('classes.curriculum.coefficient')}</th>
                  <th className="px-3 py-2.5">{t('classes.curriculum.teacher')}</th>
                  <th className="px-3 py-2.5">{t('classes.curriculum.status')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr className="border-b border-slate-50" key={item.subjectId}>
                    <td className="px-3 py-2.5 text-[13px] font-bold text-slate-800">
                      {item.subjectName}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-slate-600">
                      {item.coefficient}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-slate-500">
                      {item.teacherName ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        active={!item.alreadyAssigned}
                        activeLabel={t('classes.curriculum.willAssign')}
                        archivedLabel={t('classes.curriculum.alreadyAssigned')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
            <button
              className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving || preview.newCount === 0}
              onClick={() => {
                setIsSaving(true);
                void api
                  .copyConfirm({ sourceClassroomId, targetClassroomId }, requestOptions)
                  .then(() => {
                    onConfirmed();
                    onClose();
                  })
                  .catch((error: unknown) => {
                    setErrorKey(resolveClassesErrorMessageKey(error));
                  })
                  .finally(() => {
                    setIsSaving(false);
                  });
              }}
              type="button"
            >
              {isSaving ? t('classes.saving') : t('classes.curriculum.copyConfirm')}
            </button>
          </div>
        </div>
      ) : classrooms.length <= 1 ? (
        <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[13px] font-bold text-slate-500">
          {t('classes.curriculum.noTarget')}
        </p>
      ) : null}
    </ModalShell>
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
