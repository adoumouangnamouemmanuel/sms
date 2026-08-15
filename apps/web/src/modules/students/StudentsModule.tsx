import type {
  CreateGuardianRequest,
  CreateStudentRequest,
  GuardianRelationshipType,
  GuardianResponse,
  StudentResponse,
} from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatISODate } from '../../components/dateFormat';
import type { ImportKind } from '@edutrack/shared';
import { ImportModal } from '../imports';
import {
  ArchiveDialog,
  DetailField,
  EmptyRow,
  FormField,
  ListToolbar,
  ModalCancelButton,
  ModalShell,
  Pagination,
  SelectField,
  StatusBadge,
  formSelectClassName,
} from '../people/ui';
import { AFRICAN_COUNTRIES, DEFAULT_NATIONALITY } from './countries';
import {
  useStudentsModule,
  type PaginatedListState,
  type StudentsClient,
} from './useStudentsState';

export interface StudentsModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: StudentsClient;
  /** Session expiry (e.g. during an import) bubbles up so the app can reconnect. */
  onSessionExpired?: () => void;
}

export function StudentsModule({
  apiBaseUrl,
  capabilityToken,
  client,
  onSessionExpired,
}: StudentsModuleProps) {
  const { t } = useTranslation();
  const module = useStudentsModule({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentResponse | null>(null);
  const [guardianFormOpen, setGuardianFormOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<GuardianResponse | null>(null);
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    kind: 'student' | 'guardian';
    id: string;
    name: string;
    reactivate: boolean;
  } | null>(null);

  const errorKey = module.mutationErrorKey ?? module.profileErrorKey;

  return (
    <section aria-label={t('students.title')} className="mx-auto max-w-5xl">
      <style>{`@keyframes sms-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-600">
            {t('students.eyebrow')}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            {t('students.title')}
          </h1>
        </div>
      </div>

      {/* Tab switcher */}
      <div
        aria-label={t('students.tabs.label')}
        className="mb-8 inline-flex rounded-[20px] border border-slate-200/60 bg-slate-50/50 p-1.5 shadow-sm backdrop-blur-md"
        role="tablist"
      >
        <TabButton
          active={module.tab === 'students'}
          label={t('students.tabs.students')}
          onClick={() => {
            module.setTab('students');
          }}
        />
        <TabButton
          active={module.tab === 'guardians'}
          label={t('students.tabs.guardians')}
          onClick={() => {
            module.setTab('guardians');
          }}
        />
      </div>

      {errorKey ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {t(errorKey)}
        </div>
      ) : null}

      {module.tab === 'students' ? (
        <StudentsTab
          module={module}
          onEditStudent={(student) => {
            setEditingStudent(student);
            setStudentFormOpen(true);
          }}
          onLinkOpen={() => {
            setLinkOpen(true);
          }}
          onOpenForm={() => {
            setEditingStudent(null);
            setStudentFormOpen(true);
          }}
          onOpenImport={() => {
            setImportKind('STUDENTS');
          }}
          onSetArchiveTarget={setArchiveTarget}
        />
      ) : (
        <GuardiansTab
          module={module}
          onEditGuardian={(guardian) => {
            setEditingGuardian(guardian);
            setGuardianFormOpen(true);
          }}
          onOpenForm={() => {
            setEditingGuardian(null);
            setGuardianFormOpen(true);
          }}
          onOpenImport={() => {
            setImportKind('GUARDIANS');
          }}
          onSetArchiveTarget={setArchiveTarget}
        />
      )}

      {importKind ? (
        <ImportModal
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          kind={importKind}
          {...(onSessionExpired ? { onSessionExpired } : {})}
          onClose={() => {
            setImportKind(null);
          }}
        />
      ) : null}

      {studentFormOpen ? (
        <StudentFormModal
          onClose={() => {
            setStudentFormOpen(false);
            setEditingStudent(null);
          }}
          onSubmit={async (input) => {
            if (editingStudent) {
              await module.updateStudent(editingStudent.id, input);
            } else {
              await module.createStudent(input);
            }

            setStudentFormOpen(false);
            setEditingStudent(null);
          }}
          {...(editingStudent ? { student: editingStudent } : {})}
        />
      ) : null}

      {guardianFormOpen ? (
        <GuardianFormModal
          onClose={() => {
            setGuardianFormOpen(false);
            setEditingGuardian(null);
          }}
          {...(editingGuardian ? { guardian: editingGuardian } : {})}
          onSubmit={async (input) => {
            if (editingGuardian) {
              await module.updateGuardian(editingGuardian.id, input);
            } else {
              await module.createGuardian(input);
            }

            setGuardianFormOpen(false);
            setEditingGuardian(null);
          }}
        />
      ) : null}

      {linkOpen && module.studentProfile ? (
        <LinkGuardianModal
          guardians={module.guardians}
          onClose={() => {
            setLinkOpen(false);
          }}
          onSubmit={async (input) => {
            const studentId = module.studentProfile?.student.id;

            if (studentId) {
              await module.linkGuardian(studentId, input);
            }

            setLinkOpen(false);
          }}
        />
      ) : null}

      {archiveTarget ? (
        <ArchiveDialog
          labels={{
            body: t(
              archiveTarget.reactivate
                ? 'students.archive.reactivateBody'
                : 'students.archive.body',
              { name: archiveTarget.name }
            ),
            cancelLabel: t('students.form.cancel'),
            confirmLabel: t('students.archive.confirm'),
            reasonLabel: t('students.archive.reason'),
            reasonPlaceholder: t('students.archive.reasonPlaceholder'),
            reasonRequiredMessage: t('students.archive.reasonRequired'),
            title: t(
              archiveTarget.reactivate
                ? 'students.archive.reactivateTitle'
                : 'students.archive.title'
            ),
          }}
          onClose={() => {
            setArchiveTarget(null);
          }}
          onConfirm={async (reason) => {
            if (archiveTarget.kind === 'student') {
              if (archiveTarget.reactivate) {
                await module.reactivateStudent(archiveTarget.id, reason);
              } else {
                await module.archiveStudent(archiveTarget.id, reason);
              }
            } else if (archiveTarget.reactivate) {
              await module.reactivateGuardian(archiveTarget.id, reason);
            } else {
              await module.archiveGuardian(archiveTarget.id, reason);
            }

            setArchiveTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`relative cursor-pointer overflow-hidden rounded-[14px] px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
        active
          ? 'bg-teal-500 text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)]'
          : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm'
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <span className="relative z-10">{label}</span>
    </button>
  );
}

interface StudentsTabProps {
  module: ReturnType<typeof useStudentsModule>;
  onEditStudent: (student: StudentResponse) => void;
  onLinkOpen: () => void;
  onOpenForm: () => void;
  onOpenImport: () => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}

function StudentsTab({
  module,
  onEditStudent,
  onLinkOpen,
  onOpenForm,
  onOpenImport,
  onSetArchiveTarget,
}: StudentsTabProps) {
  const { t } = useTranslation();

  if (module.studentProfile) {
    return (
      <StudentDetail
        module={module}
        onBack={module.closeStudent}
        onEdit={onEditStudent}
        onLinkOpen={onLinkOpen}
        onSetArchiveTarget={onSetArchiveTarget}
      />
    );
  }

  return (
    <div
      className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <ListToolbar
        labels={{
          clearSearch: t('students.list.clearSearch'),
          count: t('students.list.total', { count: module.students.total }),
          filter: t('students.list.filter'),
          import: t('imports.action'),
          new: t('students.list.new'),
          search: t('students.list.search'),
          searchPlaceholder: t('students.list.searchPlaceholder'),
          status: t('students.list.status'),
          statusActive: t('students.list.statusActive'),
          statusArchived: t('students.list.statusArchived'),
        }}
        onImport={() => {
          onOpenImport();
        }}
        onNew={onOpenForm}
        onSearch={(search) => {
          module.searchStudents(search);
        }}
        onSearchValueChange={(value) => {
          module.searchStudents(value);
        }}
        onStatusChange={(status) => {
          module.setStudentsStatus(status);
        }}
        searchValue={module.students.search}
        status={module.students.status}
      />

      <StudentTable
        items={module.students.items}
        onArchive={(student) => {
          onSetArchiveTarget({
            kind: 'student',
            id: student.id,
            name: `${student.firstName} ${student.lastName}`,
            reactivate: !student.isActive,
          });
        }}
        onOpen={(student) => {
          void module.openStudent(student.id);
        }}
      />

      <Pagination
        list={module.students}
        onNext={module.nextStudentsPage}
        onPrevious={module.prevStudentsPage}
        pageLabel={(current, total) => t('students.list.page', { current, total })}
      />
    </div>
  );
}

interface GuardiansTabProps {
  module: ReturnType<typeof useStudentsModule>;
  onEditGuardian: (guardian: GuardianResponse) => void;
  onOpenForm: () => void;
  onOpenImport: () => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}

function GuardiansTab({
  module,
  onEditGuardian,
  onOpenForm,
  onOpenImport,
  onSetArchiveTarget,
}: GuardiansTabProps) {
  const { t } = useTranslation();

  if (module.guardianProfile) {
    return (
      <GuardianDetail
        module={module}
        onBack={module.closeGuardian}
        onEdit={onEditGuardian}
        onSetArchiveTarget={onSetArchiveTarget}
      />
    );
  }

  return (
    <div
      className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <ListToolbar
        labels={{
          clearSearch: t('students.list.clearSearch'),
          count: t('students.list.total', { count: module.guardians.total }),
          filter: t('students.list.filter'),
          import: t('imports.action'),
          new: t('students.list.newGuardian'),
          search: t('students.list.search'),
          searchPlaceholder: t('students.list.searchGuardiansPlaceholder'),
          status: t('students.list.status'),
          statusActive: t('students.list.statusActive'),
          statusArchived: t('students.list.statusArchived'),
        }}
        onImport={onOpenImport}
        onNew={onOpenForm}
        onSearch={(search) => {
          module.searchGuardians(search);
        }}
        onSearchValueChange={(value) => {
          module.searchGuardians(value);
        }}
        onStatusChange={(status) => {
          module.setGuardiansStatus(status);
        }}
        searchValue={module.guardians.search}
        status={module.guardians.status}
      />

      <GuardianTable
        items={module.guardians.items}
        onArchive={(guardian) => {
          onSetArchiveTarget({
            kind: 'guardian',
            id: guardian.id,
            name: `${guardian.firstName} ${guardian.lastName}`,
            reactivate: !guardian.isActive,
          });
        }}
        onOpen={(guardian) => {
          void module.openGuardian(guardian.id);
        }}
      />

      <Pagination
        list={module.guardians}
        onNext={module.nextGuardiansPage}
        onPrevious={module.prevGuardiansPage}
        pageLabel={(current, total) => t('students.list.page', { current, total })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared list building blocks
// ---------------------------------------------------------------------------

interface ArchiveTarget {
  id: string;
  kind: 'student' | 'guardian';
  name: string;
  reactivate: boolean;
}
function PrimaryBadge() {
  const { t } = useTranslation();

  return (
    <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-teal-700">
      {t('students.detail.badges.primary')}
    </span>
  );
}

function EmergencyBadge() {
  const { t } = useTranslation();

  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
      {t('students.detail.badges.emergency')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function StudentTable({
  items,
  onArchive,
  onOpen,
}: {
  items: StudentResponse[];
  onArchive: (student: StudentResponse) => void;
  onOpen: (student: StudentResponse) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <table className="w-full">
        <tbody>
          <EmptyRow message={t('students.list.empty')} />
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-100 text-left">
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.code')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.name')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.sex')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.status')}
          </th>
          <th className="px-3 py-2 text-right" />
        </tr>
      </thead>
      <tbody>
        {items.map((student) => (
          <tr className="border-b border-slate-50 hover:bg-slate-50/70" key={student.id}>
            <td className="px-3 py-3 font-mono text-[12px] font-bold text-slate-600">
              {student.code}
            </td>
            <td className="px-3 py-3">
              <button
                className="cursor-pointer text-left text-[13px] font-black text-slate-800 hover:text-teal-700"
                onClick={() => {
                  onOpen(student);
                }}
                type="button"
              >
                {student.lastName} {student.firstName}
              </button>
            </td>
            <td className="px-3 py-3 text-[13px] font-semibold text-slate-500">
              {student.sex ? t(`students.sex.${student.sex}`) : '—'}
            </td>
            <td className="px-3 py-3">
              <StatusBadge
                active={student.isActive}
                activeLabel={t('students.status.active')}
                archivedLabel={t('students.status.archived')}
              />
            </td>
            <td className="px-3 py-3 text-right">
              <button
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
                onClick={() => {
                  onArchive(student);
                }}
                type="button"
              >
                {student.isActive
                  ? t('students.actions.archive')
                  : t('students.actions.reactivate')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GuardianTable({
  items,
  onArchive,
  onOpen,
}: {
  items: GuardianResponse[];
  onArchive: (guardian: GuardianResponse) => void;
  onOpen: (guardian: GuardianResponse) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <table className="w-full">
        <tbody>
          <EmptyRow message={t('students.list.emptyGuardians')} />
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-100 text-left">
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.name')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.phone')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.columns.status')}
          </th>
          <th className="px-3 py-2 text-right" />
        </tr>
      </thead>
      <tbody>
        {items.map((guardian) => (
          <tr className="border-b border-slate-50 hover:bg-slate-50/70" key={guardian.id}>
            <td className="px-3 py-3">
              <button
                className="cursor-pointer text-left text-[13px] font-black text-slate-800 hover:text-teal-700"
                onClick={() => {
                  onOpen(guardian);
                }}
                type="button"
              >
                {guardian.lastName} {guardian.firstName}
              </button>
            </td>
            <td className="px-3 py-3 text-[13px] font-semibold text-slate-500">
              {guardian.phone ?? '—'}
            </td>
            <td className="px-3 py-3">
              <StatusBadge
                active={guardian.isActive}
                activeLabel={t('students.status.active')}
                archivedLabel={t('students.status.archived')}
              />
            </td>
            <td className="px-3 py-3 text-right">
              <button
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
                onClick={() => {
                  onArchive(guardian);
                }}
                type="button"
              >
                {guardian.isActive
                  ? t('students.actions.archive')
                  : t('students.actions.reactivate')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Detail panels
// ---------------------------------------------------------------------------

function StudentDetail({
  module,
  onBack,
  onEdit,
  onLinkOpen,
  onSetArchiveTarget,
}: {
  module: ReturnType<typeof useStudentsModule>;
  onBack: () => void;
  onEdit: (student: StudentResponse) => void;
  onLinkOpen: () => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}) {
  const { t } = useTranslation();
  const profile = module.studentProfile;

  if (!profile) {
    return null;
  }

  return (
    <div
      className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-teal-600"
            onClick={onBack}
            type="button"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('students.actions.back')}
          </button>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {profile.student.lastName} {profile.student.firstName}
          </h2>
          <p className="mt-2 font-mono text-[13px] font-bold text-slate-500">
            {profile.student.code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            active={profile.student.isActive}
            activeLabel={t('students.status.active')}
            archivedLabel={t('students.status.archived')}
          />
          <button
            className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              onEdit(profile.student);
            }}
            type="button"
          >
            <span className="relative z-10">{t('students.actions.edit')}</span>
          </button>
          <button
            className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:text-red-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            onClick={() => {
              onSetArchiveTarget({
                kind: 'student',
                id: profile.student.id,
                name: `${profile.student.firstName} ${profile.student.lastName}`,
                reactivate: !profile.student.isActive,
              });
            }}
            type="button"
          >
            <span className="relative z-10">
              {profile.student.isActive
                ? t('students.actions.archive')
                : t('students.actions.reactivate')}
            </span>
          </button>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
        <DetailField
          label={t('students.columns.sex')}
          value={profile.student.sex ? t(`students.sex.${profile.student.sex}`) : '—'}
        />
        <DetailField
          label={t('students.detail.dateOfBirth')}
          value={profile.student.dateOfBirth ? formatISODate(profile.student.dateOfBirth) : '—'}
        />
        <DetailField
          label={t('students.detail.nationality')}
          value={profile.student.nationality ?? '—'}
        />
        <DetailField label={t('students.detail.phone')} value={profile.student.phone ?? '—'} />
        <DetailField label={t('students.detail.email')} value={profile.student.email ?? '—'} />
        <DetailField label={t('students.detail.address')} value={profile.student.address ?? '—'} />
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-500">
          {t('students.detail.guardians')}
        </h3>
        <button
          className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-teal-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          onClick={onLinkOpen}
          type="button"
        >
          <span className="relative z-10">{t('students.detail.linkGuardian')}</span>
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {profile.guardians.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-[13px] font-bold text-slate-400">
            {t('students.detail.noGuardians')}
          </li>
        ) : (
          profile.guardians.map(({ link, guardian }) => (
            <li
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3"
              key={link.id}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-slate-800">
                  {guardian.lastName} {guardian.firstName}
                </p>
                <p className="text-[12px] font-semibold text-slate-400">
                  {t(`students.relationship.${link.relationshipType}`)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {link.isPrimary ? <PrimaryBadge /> : null}
                {link.isEmergency ? <EmergencyBadge /> : null}
              </div>
              <div className="flex items-center gap-1.5">
                {!link.isPrimary ? (
                  <button
                    className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 hover:border-teal-300 hover:text-teal-700"
                    onClick={() => {
                      void module.updateLink(link.id, { isPrimary: true });
                    }}
                    type="button"
                  >
                    {t('students.detail.setPrimary')}
                  </button>
                ) : null}
                <button
                  className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 hover:border-amber-300 hover:text-amber-700"
                  onClick={() => {
                    void module.updateLink(link.id, { isEmergency: !link.isEmergency });
                  }}
                  type="button"
                >
                  {link.isEmergency
                    ? t('students.detail.unsetEmergency')
                    : t('students.detail.emergency')}
                </button>
                <button
                  className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-400 hover:border-red-300 hover:text-red-600"
                  onClick={() => {
                    void module.unlinkLink(link.id);
                  }}
                  type="button"
                >
                  {t('students.detail.removeLink')}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function GuardianDetail({
  module,
  onBack,
  onEdit,
  onSetArchiveTarget,
}: {
  module: ReturnType<typeof useStudentsModule>;
  onBack: () => void;
  onEdit: (guardian: GuardianResponse) => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}) {
  const { t } = useTranslation();
  const profile = module.guardianProfile;

  if (!profile) {
    return null;
  }

  return (
    <div
      className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-teal-600"
            onClick={onBack}
            type="button"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('students.actions.back')}
          </button>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {profile.guardian.lastName} {profile.guardian.firstName}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            active={profile.guardian.isActive}
            activeLabel={t('students.status.active')}
            archivedLabel={t('students.status.archived')}
          />
          <button
            className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              onEdit(profile.guardian);
            }}
            type="button"
          >
            <span className="relative z-10">{t('students.actions.edit')}</span>
          </button>
          <button
            className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:text-red-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            onClick={() => {
              onSetArchiveTarget({
                kind: 'guardian',
                id: profile.guardian.id,
                name: `${profile.guardian.firstName} ${profile.guardian.lastName}`,
                reactivate: !profile.guardian.isActive,
              });
            }}
            type="button"
          >
            <span className="relative z-10">
              {profile.guardian.isActive
                ? t('students.actions.archive')
                : t('students.actions.reactivate')}
            </span>
          </button>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
        <DetailField label={t('students.detail.phone')} value={profile.guardian.phone ?? '—'} />
        <DetailField label={t('students.detail.email')} value={profile.guardian.email ?? '—'} />
        <DetailField label={t('students.detail.address')} value={profile.guardian.address ?? '—'} />
      </dl>

      <h3 className="text-[13px] font-black uppercase tracking-wide text-slate-500">
        {t('students.detail.students')}
      </h3>
      <ul className="mt-3 space-y-2">
        {profile.students.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-[13px] font-bold text-slate-400">
            {t('students.detail.noStudents')}
          </li>
        ) : (
          profile.students.map(({ link, student }) => (
            <li
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3"
              key={link.id}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-slate-800">
                  {student.lastName} {student.firstName}
                </p>
                <p className="font-mono text-[11px] font-bold text-slate-400">{student.code}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {link.isPrimary ? <PrimaryBadge /> : null}
                {link.isEmergency ? <EmergencyBadge /> : null}
              </div>
              <p className="text-[12px] font-semibold text-slate-400">
                {t(`students.relationship.${link.relationshipType}`)}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function StudentFormModal({
  student,
  onClose,
  onSubmit,
}: {
  student?: StudentResponse;
  onClose: () => void;
  onSubmit: (input: CreateStudentRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <ModalShell
      closeLabel={t('students.form.close')}
      onClose={onClose}
      title={t(student ? 'students.form.editStudentTitle' : 'students.form.studentTitle')}
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const firstName = readFormValue(form, 'firstName').trim();
          const lastName = readFormValue(form, 'lastName').trim();

          if (!firstName || !lastName) {
            setErrorKey('students.form.required');
            return;
          }

          setErrorKey(null);

          const code = readFormValue(form, 'code').trim();
          const dateOfBirth = readFormValue(form, 'dateOfBirth').trim();

          void onSubmit({
            ...(code ? { code } : {}),
            firstName,
            lastName,
            ...(dateOfBirth ? { dateOfBirth } : {}),
            sex: form.get('sex') ? (form.get('sex') as CreateStudentRequest['sex']) : null,
            nationality: readNullable(form, 'nationality'),
            phone: readNullable(form, 'phone'),
            email: readNullable(form, 'email'),
            address: readNullable(form, 'address'),
          }).catch(() => undefined);
        }}
      >
        {student ? (
          <p className="col-span-2 -mt-1 font-mono text-[12px] font-bold text-slate-400">
            {student.code}
          </p>
        ) : (
          <FormField label={t('students.form.code')} name="code" />
        )}
        <FormField
          defaultValue={student?.firstName ?? ''}
          label={t('students.form.firstName')}
          name="firstName"
          required
        />
        <FormField
          defaultValue={student?.lastName ?? ''}
          label={t('students.form.lastName')}
          name="lastName"
          required
        />
        <SelectField
          defaultValue={student?.sex ?? ''}
          label={t('students.form.sex')}
          name="sex"
          options={[
            { label: t('students.sex.M'), value: 'M' },
            { label: t('students.sex.F'), value: 'F' },
            { label: t('students.sex.AUTRE'), value: 'AUTRE' },
          ]}
          placeholderOption={t('students.form.selectPlaceholder')}
        />
        <FormField
          defaultValue={student?.dateOfBirth ?? ''}
          label={t('students.form.dateOfBirth')}
          name="dateOfBirth"
          type="date"
        />
        <SelectField
          defaultValue={student?.nationality ?? DEFAULT_NATIONALITY}
          label={t('students.form.nationality')}
          name="nationality"
          options={(student?.nationality && !AFRICAN_COUNTRIES.includes(student.nationality)
            ? [student.nationality, ...AFRICAN_COUNTRIES]
            : AFRICAN_COUNTRIES
          ).map((country) => ({ label: country, value: country }))}
          placeholderOption={t('students.form.selectPlaceholder')}
        />
        <FormField
          defaultValue={student?.phone ?? ''}
          label={t('students.form.phone')}
          name="phone"
        />
        <FormField
          defaultValue={student?.email ?? ''}
          label={t('students.form.email')}
          name="email"
          type="email"
        />
        <div className="col-span-2">
          <FormField
            defaultValue={student?.address ?? ''}
            label={t('students.form.address')}
            name="address"
          />
        </div>

        {errorKey ? (
          <p className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {t(errorKey)}
          </p>
        ) : null}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <ModalCancelButton label={t('students.form.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
            type="submit"
          >
            {t('students.form.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function GuardianFormModal({
  guardian,
  onClose,
  onSubmit,
}: {
  guardian?: GuardianResponse;
  onClose: () => void;
  onSubmit: (input: CreateGuardianRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <ModalShell
      closeLabel={t('students.form.close')}
      onClose={onClose}
      title={t(guardian ? 'students.form.editGuardianTitle' : 'students.form.guardianTitle')}
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const firstName = readFormValue(form, 'firstName').trim();
          const lastName = readFormValue(form, 'lastName').trim();

          if (!firstName || !lastName) {
            setErrorKey('students.form.required');
            return;
          }

          setErrorKey(null);

          void onSubmit({
            firstName,
            lastName,
            phone: readNullable(form, 'phone'),
            email: readNullable(form, 'email'),
            address: readNullable(form, 'address'),
          }).catch(() => undefined);
        }}
      >
        <FormField
          defaultValue={guardian?.firstName ?? ''}
          label={t('students.form.firstName')}
          name="firstName"
          required
        />
        <FormField
          defaultValue={guardian?.lastName ?? ''}
          label={t('students.form.lastName')}
          name="lastName"
          required
        />
        <FormField
          defaultValue={guardian?.phone ?? ''}
          label={t('students.form.phone')}
          name="phone"
        />
        <FormField
          defaultValue={guardian?.email ?? ''}
          label={t('students.form.email')}
          name="email"
          type="email"
        />
        <div className="col-span-2">
          <FormField
            defaultValue={guardian?.address ?? ''}
            label={t('students.form.address')}
            name="address"
          />
        </div>

        {errorKey ? (
          <p className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {t(errorKey)}
          </p>
        ) : null}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <ModalCancelButton label={t('students.form.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
            type="submit"
          >
            {t('students.form.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function LinkGuardianModal({
  guardians,
  onClose,
  onSubmit,
}: {
  guardians: PaginatedListState<GuardianResponse>;
  onClose: () => void;
  onSubmit: (input: {
    guardianId: string;
    relationshipType: GuardianRelationshipType;
    isPrimary?: boolean;
    isEmergency?: boolean;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <ModalShell
      closeLabel={t('students.form.close')}
      onClose={onClose}
      title={t('students.link.title')}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const guardianId = readFormValue(form, 'guardianId').trim();

          if (!guardianId) {
            setErrorKey('students.link.selectRequired');
            return;
          }

          setErrorKey(null);

          void onSubmit({
            guardianId,
            relationshipType: (form.get('relationshipType') ?? 'AUTRE') as GuardianRelationshipType,
            ...(form.get('isPrimary') === 'on' ? { isPrimary: true } : {}),
            ...(form.get('isEmergency') === 'on' ? { isEmergency: true } : {}),
          }).catch(() => undefined);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-slate-800">{t('students.link.select')}</span>
          <select className={formSelectClassName} name="guardianId">
            <option value="">{t('students.form.selectPlaceholder')}</option>
            {guardians.items.map((guardian) => (
              <option key={guardian.id} value={guardian.id}>
                {guardian.lastName} {guardian.firstName}
              </option>
            ))}
          </select>
        </label>

        <SelectField
          label={t('students.form.relationship')}
          name="relationshipType"
          options={[
            { label: t('students.relationship.PERE'), value: 'PERE' },
            { label: t('students.relationship.MERE'), value: 'MERE' },
            { label: t('students.relationship.TUTEUR'), value: 'TUTEUR' },
            { label: t('students.relationship.AUTRE'), value: 'AUTRE' },
          ]}
          placeholderOption={t('students.form.selectPlaceholder')}
        />

        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-slate-600">
            <input className="h-4 w-4 accent-teal-500" name="isPrimary" type="checkbox" />
            {t('students.form.isPrimary')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-slate-600">
            <input className="h-4 w-4 accent-teal-500" name="isEmergency" type="checkbox" />
            {t('students.form.isEmergency')}
          </label>
        </div>

        {errorKey ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {t(errorKey)}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <ModalCancelButton label={t('students.form.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
            type="submit"
          >
            {t('students.form.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function readNullable(form: FormData, name: string) {
  const value = readFormValue(form, name).trim();
  return value ? value : null;
}

function readFormValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
