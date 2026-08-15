import type { CreateTeacherRequest, TeacherLoginView, TeacherResponse } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatISODate } from '../../components/dateFormat';
import {
  ArchiveDialog,
  DetailField,
  EmptyRow,
  FormField,
  ListToolbar,
  ModalCancelButton,
  ModalShell,
  Pagination,
  StatusBadge,
} from '../people/ui';
import { useTeachersModule, type TeachersClient } from './useTeachersState';

export interface TeachersModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: TeachersClient;
}

export function TeachersModule({ apiBaseUrl, capabilityToken, client }: TeachersModuleProps) {
  const { t } = useTranslation();
  const module = useTeachersModule({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherResponse | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
    reactivate: boolean;
  } | null>(null);
  const [loginDeactivateTarget, setLoginDeactivateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const errorKey = module.mutationErrorKey ?? module.profileErrorKey;

  return (
    <section aria-label={t('teachers.title')} className="mx-auto max-w-5xl">
      <style>{`@keyframes sms-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">
            {t('teachers.eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {t('teachers.title')}
          </h1>
        </div>
      </div>

      {errorKey ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {t(errorKey)}
        </div>
      ) : null}

      {module.profile ? (
        <TeacherDetail
          module={module}
          onBack={module.closeProfile}
          onEdit={(teacher) => {
            setEditingTeacher(teacher);
            setFormOpen(true);
          }}
          onLoginDeactivate={(teacher) => {
            setLoginDeactivateTarget({
              id: teacher.id,
              name: `${teacher.firstName} ${teacher.lastName}`,
            });
          }}
          onSetArchiveTarget={setArchiveTarget}
        />
      ) : (
        <div
          className="rounded-3xl border border-white bg-white p-6 shadow-sm"
          style={{ animation: 'sms-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <ListToolbar
            labels={{
              clearSearch: t('teachers.list.clearSearch'),
              count: t('teachers.list.total', { count: module.teachers.total }),
              filter: t('teachers.list.filter'),
              new: t('teachers.list.new'),
              search: t('teachers.list.search'),
              searchPlaceholder: t('teachers.list.searchPlaceholder'),
              status: t('teachers.list.status'),
              statusActive: t('teachers.list.statusActive'),
              statusArchived: t('teachers.list.statusArchived'),
            }}
            onNew={() => {
              setEditingTeacher(null);
              setFormOpen(true);
            }}
            onSearch={(search) => {
              module.search(search);
            }}
            onSearchValueChange={(value) => {
              module.search(value);
            }}
            onStatusChange={(status) => {
              module.setStatus(status);
            }}
            searchValue={module.teachers.search}
            status={module.teachers.status}
          />

          <TeacherTable
            items={module.teachers.items}
            onArchive={(teacher) => {
              setArchiveTarget({
                id: teacher.id,
                name: `${teacher.firstName} ${teacher.lastName}`,
                reactivate: !teacher.isActive,
              });
            }}
            onOpen={(teacher) => {
              void module.openProfile(teacher.id);
            }}
          />

          <Pagination
            list={module.teachers}
            onNext={module.nextPage}
            onPrevious={module.prevPage}
            pageLabel={(current, total) => t('teachers.list.page', { current, total })}
          />
        </div>
      )}

      {formOpen ? (
        <TeacherFormModal
          onClose={() => {
            setFormOpen(false);
            setEditingTeacher(null);
          }}
          onSubmit={async (input) => {
            if (editingTeacher) {
              await module.updateTeacher(editingTeacher.id, input);
            } else {
              await module.createTeacher(input);
            }

            setFormOpen(false);
            setEditingTeacher(null);
          }}
          {...(editingTeacher ? { teacher: editingTeacher } : {})}
        />
      ) : null}

      {module.createdLogin ? (
        <CredentialsModal credentials={module.createdLogin} onClose={module.closeProfile} />
      ) : null}

      {archiveTarget ? (
        <ArchiveDialog
          labels={{
            body: t(
              archiveTarget.reactivate
                ? 'teachers.archive.reactivateBody'
                : 'teachers.archive.body',
              { name: archiveTarget.name }
            ),
            cancelLabel: t('teachers.form.cancel'),
            confirmLabel: t('teachers.archive.confirm'),
            reasonLabel: t('teachers.archive.reason'),
            reasonPlaceholder: t('teachers.archive.reasonPlaceholder'),
            reasonRequiredMessage: t('teachers.archive.reasonRequired'),
            title: t(
              archiveTarget.reactivate
                ? 'teachers.archive.reactivateTitle'
                : 'teachers.archive.title'
            ),
          }}
          onClose={() => {
            setArchiveTarget(null);
          }}
          onConfirm={async (reason) => {
            if (archiveTarget.reactivate) {
              await module.reactivateTeacher(archiveTarget.id, reason);
            } else {
              await module.archiveTeacher(archiveTarget.id, reason);
            }

            setArchiveTarget(null);
          }}
        />
      ) : null}

      {loginDeactivateTarget ? (
        <LoginDeactivateDialog
          name={loginDeactivateTarget.name}
          onClose={() => {
            setLoginDeactivateTarget(null);
          }}
          onConfirm={async (reason) => {
            await module.deactivateLogin(loginDeactivateTarget.id, reason);
            setLoginDeactivateTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function TeacherTable({
  items,
  onArchive,
  onOpen,
}: {
  items: TeacherResponse[];
  onArchive: (teacher: TeacherResponse) => void;
  onOpen: (teacher: TeacherResponse) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <table className="w-full">
        <tbody>
          <EmptyRow message={t('teachers.list.empty')} />
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-100 text-left">
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('teachers.columns.code')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('teachers.columns.name')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('teachers.columns.specialization')}
          </th>
          <th className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t('teachers.columns.status')}
          </th>
          <th className="px-3 py-2 text-right" />
        </tr>
      </thead>
      <tbody>
        {items.map((teacher) => (
          <tr className="border-b border-slate-50 hover:bg-slate-50/70" key={teacher.id}>
            <td className="px-3 py-3 font-mono text-[12px] font-bold text-slate-600">
              {teacher.code}
            </td>
            <td className="px-3 py-3">
              <button
                className="cursor-pointer text-left text-[13px] font-black text-slate-800 hover:text-teal-700"
                onClick={() => {
                  onOpen(teacher);
                }}
                type="button"
              >
                {teacher.lastName} {teacher.firstName}
              </button>
            </td>
            <td className="px-3 py-3 text-[13px] font-semibold text-slate-500">
              {teacher.specialization ?? '—'}
            </td>
            <td className="px-3 py-3">
              <StatusBadge
                active={teacher.isActive}
                activeLabel={t('teachers.status.active')}
                archivedLabel={t('teachers.status.archived')}
              />
            </td>
            <td className="px-3 py-3 text-right">
              <button
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
                onClick={() => {
                  onArchive(teacher);
                }}
                type="button"
              >
                {teacher.isActive
                  ? t('teachers.actions.archive')
                  : t('teachers.actions.reactivate')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function TeacherDetail({
  module,
  onBack,
  onEdit,
  onLoginDeactivate,
  onSetArchiveTarget,
}: {
  module: ReturnType<typeof useTeachersModule>;
  onBack: () => void;
  onEdit: (teacher: TeacherResponse) => void;
  onLoginDeactivate: (teacher: TeacherResponse) => void;
  onSetArchiveTarget: (target: { id: string; name: string; reactivate: boolean }) => void;
}) {
  const { t } = useTranslation();
  const profile = module.profile;

  if (!profile) {
    return null;
  }

  const teacher = profile.teacher;
  const login = profile.login;

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
            ← {t('teachers.actions.back')}
          </button>
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {teacher.lastName} {teacher.firstName}
          </h2>
          <p className="mt-1 font-mono text-[12px] font-bold text-slate-400">{teacher.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            active={teacher.isActive}
            activeLabel={t('teachers.status.active')}
            archivedLabel={t('teachers.status.archived')}
          />
          <button
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
            onClick={() => {
              onEdit(teacher);
            }}
            type="button"
          >
            {t('teachers.actions.edit')}
          </button>
          <button
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-red-300 hover:text-red-600"
            onClick={() => {
              onSetArchiveTarget({
                id: teacher.id,
                name: `${teacher.firstName} ${teacher.lastName}`,
                reactivate: !teacher.isActive,
              });
            }}
            type="button"
          >
            {teacher.isActive ? t('teachers.actions.archive') : t('teachers.actions.reactivate')}
          </button>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
        <DetailField
          label={t('teachers.detail.specialization')}
          value={teacher.specialization ?? '—'}
        />
        <DetailField
          label={t('teachers.detail.hireDate')}
          value={teacher.hireDate ? formatISODate(teacher.hireDate) : '—'}
        />
        <DetailField label={t('teachers.detail.phone')} value={teacher.phone ?? '—'} />
        <DetailField label={t('teachers.detail.email')} value={teacher.email ?? '—'} />
        <DetailField label={t('teachers.detail.address')} value={teacher.address ?? '—'} />
      </dl>

      <LoginSection
        login={login}
        onCreate={() => {
          void module.createLogin(teacher.id);
        }}
        onDeactivate={() => {
          onLoginDeactivate(teacher);
        }}
        onReactivate={() => {
          void module.reactivateLogin(teacher.id);
        }}
        recordActive={teacher.isActive}
      />
    </div>
  );
}

function LoginSection({
  login,
  onCreate,
  onDeactivate,
  onReactivate,
  recordActive,
}: {
  login: TeacherLoginView | null;
  onCreate: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  recordActive: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-black uppercase tracking-wide text-slate-500">
          {t('teachers.login.title')}
        </h3>
        {login ? (
          <div className="flex items-center gap-2">
            {login.isActive ? (
              <button
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-red-300 hover:text-red-600"
                onClick={onDeactivate}
                type="button"
              >
                {t('teachers.login.deactivate')}
              </button>
            ) : (
              <button
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
                onClick={onReactivate}
                type="button"
              >
                {t('teachers.login.reactivate')}
              </button>
            )}
          </div>
        ) : recordActive ? (
          <button
            className="cursor-pointer rounded-lg bg-teal-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-teal-400"
            onClick={onCreate}
            type="button"
          >
            {t('teachers.login.create')}
          </button>
        ) : null}
      </div>

      {login ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="font-mono text-[13px] font-black text-slate-800">{login.username}</p>
          <StatusBadge
            active={login.isActive}
            activeLabel={t('teachers.status.active')}
            archivedLabel={t('teachers.status.archived')}
          />
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-[13px] font-bold text-slate-400">
          {recordActive ? t('teachers.login.none') : t('teachers.login.recordArchived')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function TeacherFormModal({
  teacher,
  onClose,
  onSubmit,
}: {
  teacher?: TeacherResponse;
  onClose: () => void;
  onSubmit: (input: CreateTeacherRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <ModalShell
      closeLabel={t('teachers.form.close')}
      onClose={onClose}
      title={t(teacher ? 'teachers.form.editTeacherTitle' : 'teachers.form.teacherTitle')}
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const firstName = readFormValue(form, 'firstName').trim();
          const lastName = readFormValue(form, 'lastName').trim();

          if (!firstName || !lastName) {
            setErrorKey('teachers.form.required');
            return;
          }

          setErrorKey(null);

          const code = readFormValue(form, 'code').trim();
          const hireDate = readFormValue(form, 'hireDate').trim();

          void onSubmit({
            ...(code ? { code } : {}),
            firstName,
            lastName,
            ...(hireDate ? { hireDate } : {}),
            specialization: readNullable(form, 'specialization'),
            phone: readNullable(form, 'phone'),
            email: readNullable(form, 'email'),
            address: readNullable(form, 'address'),
          }).catch(() => undefined);
        }}
      >
        {teacher ? (
          <p className="col-span-2 -mt-1 font-mono text-[12px] font-bold text-slate-400">
            {teacher.code}
          </p>
        ) : (
          <FormField label={t('teachers.form.code')} name="code" />
        )}
        <FormField
          defaultValue={teacher?.firstName ?? ''}
          label={t('teachers.form.firstName')}
          name="firstName"
          required
        />
        <FormField
          defaultValue={teacher?.lastName ?? ''}
          label={t('teachers.form.lastName')}
          name="lastName"
          required
        />
        <FormField
          defaultValue={teacher?.specialization ?? ''}
          label={t('teachers.form.specialization')}
          name="specialization"
        />
        <FormField
          defaultValue={teacher?.hireDate ?? ''}
          label={t('teachers.form.hireDate')}
          name="hireDate"
          type="date"
        />
        <FormField
          defaultValue={teacher?.phone ?? ''}
          label={t('teachers.form.phone')}
          name="phone"
        />
        <FormField
          defaultValue={teacher?.email ?? ''}
          label={t('teachers.form.email')}
          name="email"
          type="email"
        />
        <div className="col-span-2">
          <FormField
            defaultValue={teacher?.address ?? ''}
            label={t('teachers.form.address')}
            name="address"
          />
        </div>

        {errorKey ? (
          <p className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {t(errorKey)}
          </p>
        ) : null}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <ModalCancelButton label={t('teachers.form.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
            type="submit"
          >
            {t('teachers.form.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CredentialsModal({
  credentials,
  onClose,
}: {
  credentials: { userId: string; username: string; initialPassword: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — the user can still
      // read and type the credentials manually.
    }
  };

  return (
    <ModalShell
      closeLabel={t('teachers.form.close')}
      onClose={onClose}
      title={t('teachers.login.createdTitle')}
    >
      <div className="space-y-3">
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-bold text-teal-700">
          {t('teachers.login.credentialsOnce')}
        </p>

        <CredentialRow
          label={t('teachers.login.username')}
          onCopy={() => {
            void copy(credentials.username);
          }}
          value={credentials.username}
        />
        <CredentialRow
          label={t('teachers.login.initialPassword')}
          onCopy={() => {
            void copy(credentials.initialPassword);
          }}
          value={credentials.initialPassword}
        />

        {copied ? (
          <p className="text-[12px] font-bold text-teal-700">{t('teachers.login.copied')}</p>
        ) : null}

        <div className="flex justify-end">
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
            onClick={onClose}
            type="button"
          >
            {t('teachers.form.save')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function CredentialRow({
  label,
  onCopy,
  value,
}: {
  label: string;
  onCopy: () => void;
  value: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="break-all font-mono text-[14px] font-black text-slate-800">{value}</p>
        <button
          className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:border-teal-300 hover:text-teal-700"
          onClick={onCopy}
          type="button"
        >
          {t('teachers.login.copy')}
        </button>
      </div>
    </div>
  );
}

function LoginDeactivateDialog({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  return (
    <ModalShell
      closeLabel={t('teachers.form.cancel')}
      onClose={onClose}
      title={t('teachers.login.deactivateTitle')}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (reason.trim().length < 3) {
            setErrorKey(t('teachers.archive.reasonRequired'));
            return;
          }

          setErrorKey(null);
          void onConfirm(reason.trim()).catch(() => undefined);
        }}
      >
        <p className="text-[13px] font-semibold leading-6 text-slate-500">
          {t('teachers.login.deactivateBody', { name })}
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-slate-800">
            {t('teachers.archive.reason')}
          </span>
          <textarea
            className="min-h-[80px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder={t('teachers.archive.reasonPlaceholder')}
            value={reason}
          />
        </label>

        {errorKey ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {errorKey}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <ModalCancelButton label={t('teachers.form.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-400"
            type="submit"
          >
            {t('teachers.login.deactivate')}
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
