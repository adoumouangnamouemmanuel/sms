import type {
  CreateGuardianRequest,
  CreateStudentRequest,
  GuardianRelationshipType,
  GuardianResponse,
  StudentResponse,
} from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useStudentsModule,
  type PaginatedListState,
  type StudentsClient,
} from './useStudentsState';

export interface StudentsModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: StudentsClient;
}

export function StudentsModule({ apiBaseUrl, capabilityToken, client }: StudentsModuleProps) {
  const { t } = useTranslation();
  const module = useStudentsModule({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [guardianFormOpen, setGuardianFormOpen] = useState(false);
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

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">
            {t('students.eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {t('students.title')}
          </h1>
        </div>
      </div>

      {/* Tab switcher */}
      <div
        aria-label={t('students.tabs.label')}
        className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
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
          onLinkOpen={() => {
            setLinkOpen(true);
          }}
          onOpenForm={() => {
            setStudentFormOpen(true);
          }}
          onSetArchiveTarget={setArchiveTarget}
        />
      ) : (
        <GuardiansTab
          module={module}
          onOpenForm={() => {
            setGuardianFormOpen(true);
          }}
          onSetArchiveTarget={setArchiveTarget}
        />
      )}

      {studentFormOpen ? (
        <StudentFormModal
          onClose={() => {
            setStudentFormOpen(false);
          }}
          onSubmit={async (input) => {
            await module.createStudent(input);
            setStudentFormOpen(false);
          }}
        />
      ) : null}

      {guardianFormOpen ? (
        <GuardianFormModal
          onClose={() => {
            setGuardianFormOpen(false);
          }}
          onSubmit={async (input) => {
            await module.createGuardian(input);
            setGuardianFormOpen(false);
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
          reactivate={archiveTarget.reactivate}
          targetName={archiveTarget.name}
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
      className={`cursor-pointer rounded-lg px-4 py-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
        active ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

interface StudentsTabProps {
  module: ReturnType<typeof useStudentsModule>;
  onLinkOpen: () => void;
  onOpenForm: () => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}

function StudentsTab({ module, onLinkOpen, onOpenForm, onSetArchiveTarget }: StudentsTabProps) {
  const { t } = useTranslation();
  const [draftSearch, setDraftSearch] = useState('');

  if (module.studentProfile) {
    return (
      <StudentDetail
        module={module}
        onBack={module.closeStudent}
        onLinkOpen={onLinkOpen}
        onSetArchiveTarget={onSetArchiveTarget}
      />
    );
  }

  return (
    <div
      className="rounded-3xl border border-white bg-white p-6 shadow-sm"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <ListToolbar
        count={module.students.total}
        newLabel={t('students.list.new')}
        searchPlaceholder={t('students.list.searchPlaceholder')}
        onNew={onOpenForm}
        onSearch={(search) => {
          module.searchStudents(search);
          setDraftSearch('');
        }}
        searchValue={draftSearch}
        onSearchValueChange={setDraftSearch}
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
      />
    </div>
  );
}

interface GuardiansTabProps {
  module: ReturnType<typeof useStudentsModule>;
  onOpenForm: () => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}

function GuardiansTab({ module, onOpenForm, onSetArchiveTarget }: GuardiansTabProps) {
  const { t } = useTranslation();
  const [draftSearch, setDraftSearch] = useState('');

  if (module.guardianProfile) {
    return (
      <GuardianDetail
        module={module}
        onBack={module.closeGuardian}
        onSetArchiveTarget={onSetArchiveTarget}
      />
    );
  }

  return (
    <div
      className="rounded-3xl border border-white bg-white p-6 shadow-sm"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <ListToolbar
        count={module.guardians.total}
        newLabel={t('students.list.newGuardian')}
        searchPlaceholder={t('students.list.searchGuardiansPlaceholder')}
        onNew={onOpenForm}
        onSearch={(search) => {
          module.searchGuardians(search);
          setDraftSearch('');
        }}
        searchValue={draftSearch}
        onSearchValueChange={setDraftSearch}
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

function ListToolbar({
  count,
  newLabel,
  onNew,
  onSearch,
  searchPlaceholder,
  searchValue,
  onSearchValueChange,
}: {
  count: number;
  newLabel: string;
  onNew: () => void;
  onSearch: (search: string) => void;
  searchPlaceholder: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] font-bold text-slate-500">{t('students.list.total', { count })}</p>

      <form
        className="flex flex-1 items-center gap-2 sm:max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(searchValue);
        }}
      >
        <input
          aria-label={t('students.list.search')}
          className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
          onChange={(event) => {
            onSearchValueChange(event.target.value);
          }}
          placeholder={searchPlaceholder}
          type="search"
          value={searchValue}
        />
        <button
          className="h-9 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          type="submit"
        >
          {t('students.list.search')}
        </button>
      </form>

      <button
        className="h-9 cursor-pointer rounded-xl bg-teal-500 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        onClick={onNew}
        type="button"
      >
        {newLabel}
      </button>
    </div>
  );
}

function Pagination({
  list,
  onNext,
  onPrevious,
}: {
  list: PaginatedListState<unknown>;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const { t } = useTranslation();
  const currentPage = Math.floor(list.offset / list.limit) + 1;

  return (
    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
      <p className="text-[12px] font-bold text-slate-400">
        {t('students.list.page', { current: currentPage, total: list.pageCount })}
      </p>
      <div className="flex items-center gap-2">
        <button
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={list.offset === 0}
          onClick={onPrevious}
          type="button"
        >
          {t('students.list.previous')}
        </button>
        <button
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={list.offset + list.limit >= list.total}
          onClick={onNext}
          type="button"
        >
          {t('students.list.next')}
        </button>
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm font-bold text-slate-400" colSpan={5}>
        {message}
      </td>
    </tr>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();

  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/60 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
      {t('students.status.active')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {t('students.status.archived')}
    </span>
  );
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
              <StatusBadge active={student.isActive} />
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
              <StatusBadge active={guardian.isActive} />
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
  onLinkOpen,
  onSetArchiveTarget,
}: {
  module: ReturnType<typeof useStudentsModule>;
  onBack: () => void;
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
      className="rounded-3xl border border-white bg-white p-6 shadow-sm"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            className="mb-3 cursor-pointer text-[12px] font-bold text-slate-400 hover:text-teal-700"
            onClick={onBack}
            type="button"
          >
            ← {t('students.actions.back')}
          </button>
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {profile.student.lastName} {profile.student.firstName}
          </h2>
          <p className="mt-1 font-mono text-[12px] font-bold text-slate-400">
            {profile.student.code}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge active={profile.student.isActive} />
          <button
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
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
            {profile.student.isActive
              ? t('students.actions.archive')
              : t('students.actions.reactivate')}
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
          value={profile.student.dateOfBirth ?? '—'}
        />
        <DetailField
          label={t('students.detail.nationality')}
          value={profile.student.nationality ?? '—'}
        />
        <DetailField label={t('students.detail.phone')} value={profile.student.phone ?? '—'} />
        <DetailField label={t('students.detail.email')} value={profile.student.email ?? '—'} />
        <DetailField label={t('students.detail.address')} value={profile.student.address ?? '—'} />
      </dl>

      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-black uppercase tracking-wide text-slate-500">
          {t('students.detail.guardians')}
        </h3>
        <button
          className="cursor-pointer rounded-lg bg-teal-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-teal-400"
          onClick={onLinkOpen}
          type="button"
        >
          {t('students.detail.linkGuardian')}
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
  onSetArchiveTarget,
}: {
  module: ReturnType<typeof useStudentsModule>;
  onBack: () => void;
  onSetArchiveTarget: (target: ArchiveTarget) => void;
}) {
  const { t } = useTranslation();
  const profile = module.guardianProfile;

  if (!profile) {
    return null;
  }

  return (
    <div
      className="rounded-3xl border border-white bg-white p-6 shadow-sm"
      style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            className="mb-3 cursor-pointer text-[12px] font-bold text-slate-400 hover:text-teal-700"
            onClick={onBack}
            type="button"
          >
            ← {t('students.actions.back')}
          </button>
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {profile.guardian.lastName} {profile.guardian.firstName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge active={profile.guardian.isActive} />
          <button
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
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
            {profile.guardian.isActive
              ? t('students.actions.archive')
              : t('students.actions.reactivate')}
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-bold text-slate-700">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
          <button
            aria-label={t('students.form.close')}
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

function StudentFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CreateStudentRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <ModalShell onClose={onClose} title={t('students.form.studentTitle')}>
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
        <FormField label={t('students.form.code')} name="code" optional />
        <FormField label={t('students.form.firstName')} name="firstName" required />
        <FormField label={t('students.form.lastName')} name="lastName" required />
        <SelectField
          label={t('students.form.sex')}
          name="sex"
          options={[
            { label: t('students.sex.M'), value: 'M' },
            { label: t('students.sex.F'), value: 'F' },
            { label: t('students.sex.AUTRE'), value: 'AUTRE' },
          ]}
        />
        <FormField label={t('students.form.dateOfBirth')} name="dateOfBirth" type="date" />
        <FormField label={t('students.form.nationality')} name="nationality" />
        <FormField label={t('students.form.phone')} name="phone" />
        <FormField label={t('students.form.email')} name="email" type="email" />
        <div className="col-span-2">
          <FormField label={t('students.form.address')} name="address" />
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
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CreateGuardianRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <ModalShell onClose={onClose} title={t('students.form.guardianTitle')}>
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
        <FormField label={t('students.form.firstName')} name="firstName" required />
        <FormField label={t('students.form.lastName')} name="lastName" required />
        <FormField label={t('students.form.phone')} name="phone" />
        <FormField label={t('students.form.email')} name="email" type="email" />
        <div className="col-span-2">
          <FormField label={t('students.form.address')} name="address" />
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
    <ModalShell onClose={onClose} title={t('students.link.title')}>
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
        <label className="block">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.link.select')}
          </span>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
            name="guardianId"
          >
            <option value="">—</option>
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

function ArchiveDialog({
  reactivate,
  targetName,
  onClose,
  onConfirm,
}: {
  reactivate: boolean;
  targetName: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  return (
    <ModalShell
      onClose={onClose}
      title={t(reactivate ? 'students.archive.reactivateTitle' : 'students.archive.title')}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (reason.trim().length < 3) {
            setErrorKey('students.archive.reasonRequired');
            return;
          }

          setErrorKey(null);
          void onConfirm(reason.trim()).catch(() => undefined);
        }}
      >
        <p className="text-[13px] font-semibold leading-6 text-slate-500">
          {reactivate
            ? t('students.archive.reactivateBody', { name: targetName })
            : t('students.archive.body', { name: targetName })}
        </p>
        <label className="block">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('students.archive.reason')}
          </span>
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-700 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder={t('students.archive.reasonPlaceholder')}
            value={reason}
          />
        </label>

        {errorKey ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {t(errorKey)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <ModalCancelButton label={t('students.form.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-400"
            type="submit"
          >
            {t('students.archive.confirm')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalCancelButton({ label, onClose }: { label: string; onClose: () => void }) {
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

function FormField({
  label,
  name,
  type = 'text',
  required = false,
  optional = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
        {required ? ' *' : optional ? ` (${t('students.form.optional')})` : ''}
      </span>
      <input
        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</span>
      <select
        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
        name={name}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
