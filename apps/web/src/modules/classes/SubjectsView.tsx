import { SUBJECT_CATEGORIES, type SubjectCategory, type SubjectResponse } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportModal } from '../imports';
import {
  ArchiveDialog,
  EmptyRow,
  formInputClassName,
  formSelectClassName,
  ListToolbar,
  ModalCancelButton,
  ModalShell,
  Pagination,
  StatusBadge,
} from '../people/ui';
import type { ClassesClient } from './useClassesState';
import { useClassesModule } from './useClassesState';

export interface SubjectsViewProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
  onSessionExpired?: () => void;
}

export function SubjectsView({
  apiBaseUrl,
  capabilityToken,
  client,
  onSessionExpired,
}: SubjectsViewProps) {
  const { t } = useTranslation();
  const module = useClassesModule({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectResponse | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
    reactivate: boolean;
  } | null>(null);

  const errorKey = module.mutationErrorKey ?? module.subjects.errorKey;

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
            count: t('classes.subjects.count', { count: module.subjects.total }),
            new: t('classes.subjects.new'),
            search: t('classes.subjects.search'),
            searchPlaceholder: t('classes.subjects.searchPlaceholder'),
            clearSearch: t('classes.subjects.clearSearch'),
            filter: t('classes.subjects.filter'),
            status: t('classes.subjects.status'),
            statusActive: t('classes.subjects.statusActive'),
            statusArchived: t('classes.subjects.statusArchived'),
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
            module.searchSubjects(query);
          }}
          onSearchValueChange={(value) => {
            setSearchValue(value);
            if (!value) {
              module.searchSubjects('');
            }
          }}
          onStatusChange={module.setSubjectsStatus}
          searchValue={searchValue}
          status={module.subjects.status}
        />

        {module.subjects.items.length === 0 && module.subjects.isLoading ? (
          <p className="py-10 text-center text-sm font-bold text-slate-400">
            {t('classes.loading')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2.5">{t('classes.subjects.code')}</th>
                  <th className="px-3 py-2.5">{t('classes.subjects.name')}</th>
                  <th className="px-3 py-2.5">{t('classes.subjects.category')}</th>
                  <th className="px-3 py-2.5">{t('classes.subjects.status')}</th>
                  <th className="px-3 py-2.5 text-right">{t('classes.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {module.subjects.items.length === 0 ? (
                  <EmptyRow message={t('classes.subjects.empty')} />
                ) : (
                  module.subjects.items.map((subject) => (
                    <tr
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                      key={subject.id}
                    >
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[12px] font-bold text-slate-700">
                          {subject.code}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[13px] font-bold text-slate-800">
                        {subject.name}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-indigo-200/60 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                          {t(`classes.categories.${subject.category}`)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          active={subject.isActive}
                          activeLabel={t('classes.statusActive')}
                          archivedLabel={t('classes.statusArchived')}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                            onClick={() => {
                              setEditing(subject);
                              setFormOpen(true);
                            }}
                            type="button"
                          >
                            {t('classes.edit')}
                          </button>
                          <button
                            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                            onClick={() => {
                              setArchiveTarget({
                                id: subject.id,
                                name: subject.name,
                                reactivate: !subject.isActive,
                              });
                            }}
                            type="button"
                          >
                            {subject.isActive ? t('classes.archive') : t('classes.reactivate')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          list={module.subjects}
          onNext={module.subjectsNextPage}
          onPrevious={module.subjectsPrevPage}
          pageLabel={(current, total) => t('classes.pagination', { current, total })}
        />
      </section>

      {formOpen ? (
        <SubjectFormModal
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            if (editing) {
              await module.updateSubject(editing.id, input);
            } else {
              await module.createSubject(input);
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
                ? 'classes.subjects.reactivateTitle'
                : 'classes.subjects.archiveTitle',
              { name: archiveTarget.name }
            ),
            body: t(
              archiveTarget.reactivate
                ? 'classes.subjects.reactivateBody'
                : 'classes.subjects.archiveBody',
              { name: archiveTarget.name }
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
              await module.reactivateSubject(archiveTarget.id, reason);
            } else {
              await module.archiveSubject(archiveTarget.id, reason);
            }
            setArchiveTarget(null);
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportModal
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          kind="SUBJECTS"
          {...(onSessionExpired ? { onSessionExpired } : {})}
          onClose={() => {
            setImportOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function SubjectFormModal({
  editing,
  onClose,
  onSubmit,
}: {
  editing: SubjectResponse | null;
  onClose: () => void;
  onSubmit: (input: {
    code: string;
    name: string;
    nameEn?: string | null;
    nameAr?: string | null;
    shortLabel?: string | null;
    category: SubjectCategory;
    recordVersion?: number;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [nameEn, setNameEn] = useState(editing?.nameEn ?? '');
  const [nameAr, setNameAr] = useState(editing?.nameAr ?? '');
  const [shortLabel, setShortLabel] = useState(editing?.shortLabel ?? '');
  const [category, setCategory] = useState<SubjectCategory>(editing?.category ?? 'MATHEMATIQUES');
  const [isSaving, setIsSaving] = useState(false);

  const fieldClassName = `${formInputClassName} h-11`;
  const selectClassName = `${formSelectClassName} h-11`;

  return (
    <ModalShell
      closeLabel={t('classes.cancel')}
      onClose={onClose}
      title={t(editing ? 'classes.subjects.editTitle' : 'classes.subjects.newTitle')}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setIsSaving(true);
          void onSubmit({
            ...(editing ? { recordVersion: editing.recordVersion } : {}),
            code,
            name: name.trim(),
            nameEn: nameEn.trim() || null,
            nameAr: nameAr.trim() || null,
            shortLabel: shortLabel.trim() || null,
            category,
          })
            .catch(() => undefined)
            .finally(() => {
              setIsSaving(false);
            });
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.subjects.code')} *
          </span>
          <input
            className={fieldClassName}
            disabled={Boolean(editing)}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            placeholder={t('classes.subjects.codePlaceholder')}
            required
            value={code}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.subjects.name')} *
          </span>
          <input
            className={fieldClassName}
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
            value={name}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-slate-800">
              {t('classes.subjects.nameEn')}
            </span>
            <input
              className={fieldClassName}
              onChange={(event) => {
                setNameEn(event.target.value);
              }}
              value={nameEn}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-slate-800">
              {t('classes.subjects.nameAr')}
            </span>
            <input
              className={fieldClassName}
              onChange={(event) => {
                setNameAr(event.target.value);
              }}
              value={nameAr}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.subjects.shortLabel')}
          </span>
          <input
            className={fieldClassName}
            onChange={(event) => {
              setShortLabel(event.target.value);
            }}
            value={shortLabel}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.subjects.category')} *
          </span>
          <select
            className={selectClassName}
            onChange={(event) => {
              setCategory(event.target.value as SubjectCategory);
            }}
            value={category}
          >
            {SUBJECT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`classes.categories.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || name.trim().length < 2 || code.trim().length < 2}
            type="submit"
          >
            {isSaving ? t('classes.saving') : t('classes.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
