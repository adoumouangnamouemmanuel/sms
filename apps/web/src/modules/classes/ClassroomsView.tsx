import type { ClassroomView, SetupStateResponse } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportModal } from '../imports';
import {
  ArchiveDialog,
  formInputClassName,
  formSelectClassName,
  ListToolbar,
  ModalCancelButton,
  ModalShell,
  Pagination,
} from '../people/ui';
import { ClassroomDetailView } from './ClassroomDetailView';
import type { ClassesClient } from './useClassesState';
import { useClassesModule } from './useClassesState';

export interface ClassroomsViewProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
  setupState: SetupStateResponse;
  onSessionExpired?: () => void;
}

export function ClassroomsView({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  onSessionExpired,
}: ClassroomsViewProps) {
  const { t } = useTranslation();
  const module = useClassesModule({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassroomView | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    code: string;
    reactivate: boolean;
  } | null>(null);
  const [openClassroom, setOpenClassroom] = useState<ClassroomView | null>(null);

  const errorKey = module.mutationErrorKey ?? module.classrooms.errorKey;

  if (openClassroom) {
    return (
      <ClassroomDetailView
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken ? { capabilityToken } : {})}
        {...(client ? { client } : {})}
        classroom={openClassroom}
        {...(onSessionExpired ? { onSessionExpired } : {})}
        onBack={() => {
          setOpenClassroom(null);
          void module.refreshClassrooms();
        }}
      />
    );
  }

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

      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <ListToolbar
          labels={{
            count: t('classes.classrooms.count', { count: module.classrooms.total }),
            new: t('classes.classrooms.new'),
            search: t('classes.classrooms.search'),
            searchPlaceholder: t('classes.classrooms.searchPlaceholder'),
            clearSearch: t('classes.classrooms.clearSearch'),
            filter: t('classes.classrooms.filter'),
            status: t('classes.classrooms.status'),
            statusActive: t('classes.classrooms.statusActive'),
            statusArchived: t('classes.classrooms.statusArchived'),
            import: t('imports.action'),
          }}
          onImport={() => {
            setImportOpen(true);
          }}
          onNew={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          onSearch={(query) => {
            module.searchClassrooms(query);
          }}
          onSearchValueChange={(value) => {
            setSearchValue(value);
            if (!value) {
              module.searchClassrooms('');
            }
          }}
          onStatusChange={module.setClassroomsStatus}
          searchValue={searchValue}
          status={module.classrooms.status}
        />
        {/* Level filter row */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            {t('classes.classrooms.levelFilter')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              aria-pressed={module.classroomLevelFilter === undefined}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                module.classroomLevelFilter === undefined
                  ? 'border border-teal-300 bg-teal-50 text-teal-700'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
              }`}
              onClick={() => {
                module.setClassroomLevelFilter(undefined);
              }}
              type="button"
            >
              {t('classes.classrooms.allLevels')}
            </button>
            {setupState.classLevels.map((level) => (
              <button
                aria-pressed={module.classroomLevelFilter === level.id}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  module.classroomLevelFilter === level.id
                    ? 'border border-teal-300 bg-teal-50 text-teal-700'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
                }`}
                key={level.id}
                onClick={() => {
                  module.setClassroomLevelFilter(level.id);
                }}
                type="button"
              >
                {level.name}
              </button>
            ))}
          </div>
        </div>{' '}
        {module.classrooms.items.length === 0 ? (
          module.classrooms.isLoading ? (
            <p className="py-10 text-center text-sm font-bold text-slate-400">
              {t('classes.loading')}
            </p>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 py-14 text-center">
              <p className="text-sm font-bold text-slate-400">{t('classes.classrooms.empty')}</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {module.classrooms.items.map((item) => {
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
                    setOpenClassroom(item);
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
                  <p className="pr-8 text-[17px] font-black tracking-tight text-slate-900">
                    {item.classLevelName} {classroom.code}
                  </p>
                  {classroom.name ? (
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-400">
                      {classroom.name}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {classroom.capacity !== null
                        ? t('classes.classrooms.effectifOf', {
                            count: item.activeEnrollmentCount,
                            capacity: classroom.capacity,
                          })
                        : t('classes.classrooms.effectif', {
                            count: item.activeEnrollmentCount,
                          })}
                    </span>
                    {classroom.capacity !== null && ratio !== null ? (
                      <span
                        aria-label={t('classes.classrooms.capacityLabel', {
                          percent: Math.round(ratio * 100),
                        })}
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                      >
                        <span
                          className={`block h-full rounded-full transition-all ${
                            ratio >= 1
                              ? 'bg-red-400'
                              : ratio >= 0.85
                                ? 'bg-amber-400'
                                : 'bg-teal-400'
                          }`}
                          style={{ width: `${String(Math.round(ratio * 100))}%` }}
                        />
                      </span>
                    ) : null}
                  </div>
                  {item.isExamYear ? (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200/60">
                      {t('classes.classrooms.examYear')}
                    </span>
                  ) : null}
                  <p className="mt-3 text-[11px] font-semibold text-slate-400">
                    {item.academicYearLabel}
                  </p>
                </button>
              );
            })}
          </div>
        )}
        <Pagination
          list={module.classrooms}
          onNext={module.classroomsNextPage}
          onPrevious={module.classroomsPrevPage}
          pageLabel={(current, total) => t('classes.pagination', { current, total })}
        />
      </section>

      {formOpen ? (
        <ClassroomFormModal
          editing={editing}
          setupState={setupState}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            if (editing) {
              await module.updateClassroom(editing.classroom.id, input);
            } else {
              await module.createClassroom(input);
            }
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      {archiveTarget ? (
        <ArchiveDialog
          labels={{
            title: t(
              archiveTarget.reactivate
                ? 'classes.classrooms.reactivateTitle'
                : 'classes.classrooms.archiveTitle',
              { code: archiveTarget.code }
            ),
            body: t(
              archiveTarget.reactivate
                ? 'classes.classrooms.reactivateBody'
                : 'classes.classrooms.archiveBody',
              { code: archiveTarget.code }
            ),
            reasonLabel: t('classes.archiveReasonLabel'),
            reasonPlaceholder: t('classes.archiveReasonPlaceholder'),
            reasonRequiredMessage: t('classes.archiveReasonRequired'),
            confirmLabel: t(archiveTarget.reactivate ? 'classes.reactivate' : 'classes.archive'),
            cancelLabel: t('classes.cancel'),
          }}
          onClose={() => {
            setArchiveTarget(null);
          }}
          onConfirm={async (reason) => {
            if (archiveTarget.reactivate) {
              await module.reactivateClassroom(archiveTarget.id, reason);
            } else {
              await module.archiveClassroom(archiveTarget.id, reason);
            }
            setArchiveTarget(null);
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportModal
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          kind="CLASSROOMS"
          {...(onSessionExpired ? { onSessionExpired } : {})}
          onClose={() => {
            setImportOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ClassroomFormModal({
  editing,
  setupState,
  onClose,
  onSubmit,
}: {
  editing: ClassroomView | null;
  setupState: SetupStateResponse;
  onClose: () => void;
  onSubmit: (input: {
    academicYearId: string;
    classLevelId: string;
    code: string;
    name?: string | null;
    capacity?: number | null;
    recordVersion?: number;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const currentYear = setupState.academicYear;
  const [academicYearId, setAcademicYearId] = useState(
    editing?.classroom.academicYearId ?? currentYear?.id ?? ''
  );
  const [classLevelId, setClassLevelId] = useState(
    editing?.classroom.classLevelId ?? setupState.classLevels[0]?.id ?? ''
  );
  const [code, setCode] = useState(editing?.classroom.code ?? '');
  const [name, setName] = useState(editing?.classroom.name ?? '');
  const [capacity, setCapacity] = useState(
    editing?.classroom.capacity !== null && editing?.classroom.capacity !== undefined
      ? String(editing.classroom.capacity)
      : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const fieldClassName = `${formInputClassName} h-11`;
  const selectClassName = `${formSelectClassName} h-11`;

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      title={t(editing ? 'classes.classrooms.editTitle' : 'classes.classrooms.newTitle')}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setIsSaving(true);
          void onSubmit({
            ...(editing ? { recordVersion: editing.classroom.recordVersion } : {}),
            academicYearId,
            classLevelId,
            code,
            name: name.trim() || null,
            capacity: capacity.trim() ? Number(capacity) : null,
          })
            .catch(() => undefined)
            .finally(() => {
              setIsSaving(false);
            });
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.classrooms.academicYear')} *
          </span>
          <select
            className={selectClassName}
            disabled={Boolean(editing)}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
            }}
            value={academicYearId}
          >
            {currentYear ? (
              <option value={currentYear.id}>{currentYear.label}</option>
            ) : (
              <option value="">{t('classes.classrooms.noYear')}</option>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.classrooms.level')} *
          </span>
          <select
            className={selectClassName}
            disabled={Boolean(editing)}
            onChange={(event) => {
              setClassLevelId(event.target.value);
            }}
            value={classLevelId}
          >
            {setupState.classLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.classrooms.code')} *
          </span>
          <input
            className={fieldClassName}
            disabled={Boolean(editing)}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            placeholder={t('classes.classrooms.codePlaceholder')}
            required
            value={code}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.classrooms.name')}
          </span>
          <input
            className={fieldClassName}
            onChange={(event) => {
              setName(event.target.value);
            }}
            value={name}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.classrooms.capacity')}
          </span>
          <input
            className={fieldClassName}
            min={1}
            onChange={(event) => {
              setCapacity(event.target.value);
            }}
            type="number"
            value={capacity}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? t('classes.saving') : t('classes.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
