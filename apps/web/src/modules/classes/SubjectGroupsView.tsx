import type {
  CreateSubjectGroupRequest,
  SubjectGroupMemberView,
  SubjectGroupView,
  SubjectGroupsResponse,
  SubjectResponse,
  UpdateSubjectGroupRequest,
} from '@edutrack/shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName, ModalCancelButton, ModalShell } from '../people/ui';
import type { ClassesClient } from './useClassesState';
import {
  archiveSubjectGroup as archiveSubjectGroupRequest,
  createSubjectGroup as createSubjectGroupRequest,
  listSubjectGroupMembers,
  listSubjectGroups,
  listSubjects,
  setSubjectGroupMembers,
  updateSubjectGroup as updateSubjectGroupRequest,
  type ClassesRequestOptions,
} from './classesApi';
import { resolveClassesErrorMessageKey } from './classesErrors';

/**
 * School-defined subject groups / sections (roadmap §9.6): name, display
 * order and membership. Membership order is the array order shown here -
 * school configuration, never inferred from the subject category.
 */
export function SubjectGroupsView({
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

  const [groups, setGroups] = useState<SubjectGroupsResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [members, setMembers] = useState<SubjectGroupMemberView[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubjectGroupView | null>(null);

  const load = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setIsLoading(true);
    setErrorKey(null);

    try {
      const [groupsData, subjectPage] = await Promise.all([
        client?.listSubjectGroups
          ? client.listSubjectGroups(requestOptions())
          : listSubjectGroups(apiBaseUrl ?? '', requestOptions()),
        client
          ? client.listSubjects({ limit: 100, offset: 0, status: 'active' }, requestOptions())
          : listSubjects(
              apiBaseUrl ?? '',
              { limit: 100, offset: 0, status: 'active' },
              requestOptions()
            ),
      ]);

      setGroups(groupsData);
      setSubjects(subjectPage.items);
      setSelectedGroupId((current) => current ?? groupsData.items[0]?.id ?? null);
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
    void load();
  }, [load]);

  const loadMembers = useCallback(
    async (groupId: string) => {
      if (!apiBaseUrl && !client) {
        return;
      }

      setIsMembersLoading(true);
      setErrorKey(null);

      try {
        const data = client?.listSubjectGroupMembers
          ? await client.listSubjectGroupMembers(groupId, requestOptions())
          : await listSubjectGroupMembers(apiBaseUrl ?? '', groupId, requestOptions());
        setMembers(data.members);
      } catch (error) {
        if (isInvalidAccessToken(error)) {
          onSessionExpired?.();
          return;
        }

        setErrorKey(resolveClassesErrorMessageKey(error));
      } finally {
        setIsMembersLoading(false);
      }
    },
    [apiBaseUrl, client, onSessionExpired, requestOptions]
  );

  useEffect(() => {
    if (selectedGroupId) {
      void loadMembers(selectedGroupId);
    } else {
      setMembers([]);
    }
  }, [selectedGroupId, loadMembers]);

  const selectedGroup = groups?.items.find((group) => group.id === selectedGroupId) ?? null;

  const refreshGroups = useCallback(async () => {
    const data = client?.listSubjectGroups
      ? await client.listSubjectGroups(requestOptions())
      : await listSubjectGroups(apiBaseUrl ?? '', requestOptions());
    setGroups(data);
    return data;
  }, [apiBaseUrl, client, requestOptions]);

  const handleArchive = async (group: SubjectGroupView) => {
    setErrorKey(null);

    try {
      if (client?.archiveSubjectGroup) {
        await client.archiveSubjectGroup(group.id, requestOptions());
      } else {
        await archiveSubjectGroupRequest(apiBaseUrl ?? '', group.id, requestOptions());
      }

      const next = await refreshGroups();
      if (selectedGroupId === group.id) {
        setSelectedGroupId(next.items[0]?.id ?? null);
      }
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveClassesErrorMessageKey(error));
    }
  };

  const toggleMember = (subjectId: string) => {
    setMembers((current) => {
      const exists = current.some((member) => member.subjectId === subjectId);

      if (exists) {
        return current.filter((member) => member.subjectId !== subjectId);
      }

      const subjectItem = subjects.find((subject) => subject.id === subjectId);
      if (!subjectItem) {
        return current;
      }

      return [
        ...current,
        {
          subjectId: subjectItem.id,
          subjectCode: subjectItem.code,
          subjectName: subjectItem.name,
          displayOrder: current.length + 1,
        },
      ];
    });
  };

  const moveMember = (subjectId: string, direction: -1 | 1) => {
    setMembers((current) => {
      const index = current.findIndex((member) => member.subjectId === subjectId);
      const target = index + direction;

      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);

      return next.map((member, order) => ({ ...member, displayOrder: order + 1 }));
    });
  };

  const handleSaveMembers = async () => {
    if (!selectedGroupId) {
      return;
    }

    setErrorKey(null);

    try {
      if (client?.setSubjectGroupMembers) {
        await client.setSubjectGroupMembers(
          selectedGroupId,
          {
            subjectIds: members.map((member) => member.subjectId),
          },
          requestOptions()
        );
      } else {
        await setSubjectGroupMembers(
          apiBaseUrl ?? '',
          selectedGroupId,
          { subjectIds: members.map((member) => member.subjectId) },
          requestOptions()
        );
      }

      await refreshGroups();
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveClassesErrorMessageKey(error));
    }
  };

  if (isLoading && !groups) {
    return (
      <div className="flex h-40 items-center justify-center" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
      </div>
    );
  }

  const groupItems = groups?.items ?? [];

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
          label={t('classes.groups.summary.groups')}
          tone="teal"
          value={groupItems.length}
        />
        <SummaryStat
          label={t('classes.groups.summary.subjects')}
          tone="indigo"
          value={subjects.length}
        />
        <SummaryStat
          label={t('classes.groups.summary.members')}
          tone="amber"
          value={members.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Group list */}
        <section className="rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900">
                {t('classes.groups.title')}
              </h3>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">
                {t('classes.groups.hint')}
              </p>
            </div>
            <button
              className="cursor-pointer rounded-2xl bg-teal-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:scale-105 hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setErrorKey(null);
                setIsCreating(true);
              }}
              type="button"
            >
              {t('classes.groups.new')}
            </button>
          </div>

          {groupItems.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
              <p className="text-sm font-black text-slate-500">{t('classes.groups.empty')}</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">
                {t('classes.groups.emptyHint')}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {groupItems.map((group) => (
                <li
                  className={`group flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all ${
                    selectedGroupId === group.id
                      ? 'border-teal-300 bg-teal-50/60 shadow-sm'
                      : 'border-slate-200/60 bg-white hover:border-slate-300/80 hover:bg-slate-50/50'
                  }`}
                  key={group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-black ${
                      selectedGroupId === group.id
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {group.displayOrder}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-slate-800">{group.name}</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {t('classes.groups.memberCount', { count: group.subjectCount })}
                    </p>
                  </div>
                  <button
                    aria-label={t('classes.groups.edit')}
                    className="cursor-pointer rounded-lg p-2 text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-teal-600 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingGroup(group);
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    aria-label={t('classes.groups.archive')}
                    className="cursor-pointer rounded-lg p-2 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleArchive(group);
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Membership editor */}
        <section className="rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <div className="mb-5">
            <h3 className="text-base font-black tracking-tight text-slate-900">
              {t('classes.groups.membersTitle')}
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('classes.groups.membersHint')}
            </p>
          </div>

          {!selectedGroup ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
              <p className="text-sm font-black text-slate-500">{t('classes.groups.noSelection')}</p>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-2xl border border-teal-200/70 bg-teal-50/50 p-3.5">
                <p className="text-[13px] font-black text-teal-800">{selectedGroup.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-teal-600">
                  {t('classes.groups.orderHint')}
                </p>
              </div>

              {isMembersLoading ? (
                <div className="flex h-24 items-center justify-center" role="status">
                  <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
                </div>
              ) : (
                <>
                  {/* Assigned members */}
                  <div className="space-y-2">
                    {members.length === 0 ? (
                      <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 p-6 text-center text-[12px] font-bold text-slate-400">
                        {t('classes.groups.noMembers')}
                      </p>
                    ) : (
                      members.map((member, index) => (
                        <div
                          className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-2.5"
                          key={member.subjectId}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-black text-slate-400 shadow-sm ring-1 ring-slate-200/80">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold text-slate-700">
                              {member.subjectName}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              {member.subjectCode}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              aria-label={t('classes.groups.moveUp')}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-30"
                              disabled={index === 0}
                              onClick={() => {
                                moveMember(member.subjectId, -1);
                              }}
                              type="button"
                            >
                              ↑
                            </button>
                            <button
                              aria-label={t('classes.groups.moveDown')}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-30"
                              disabled={index === members.length - 1}
                              onClick={() => {
                                moveMember(member.subjectId, 1);
                              }}
                              type="button"
                            >
                              ↓
                            </button>
                            <button
                              aria-label={t('classes.groups.remove')}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              onClick={() => {
                                toggleMember(member.subjectId);
                              }}
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Available subjects */}
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      {t('classes.groups.available')}
                    </p>
                    <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                      {subjects
                        .filter((subject) => !members.some((m) => m.subjectId === subject.id))
                        .map((subject) => (
                          <button
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:border-teal-300 hover:text-teal-700"
                            key={subject.id}
                            onClick={() => {
                              toggleMember(subject.id);
                            }}
                            type="button"
                          >
                            + {subject.name}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400"
                      onClick={() => {
                        void handleSaveMembers();
                      }}
                      type="button"
                    >
                      {t('classes.save')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {isCreating ? (
        <GroupFormModal
          apiBaseUrl={apiBaseUrl}
          {...(client ? { client } : {})}
          onClose={() => {
            setIsCreating(false);
          }}
          onSaved={async () => {
            setIsCreating(false);
            await refreshGroups();
          }}
          {...(onSessionExpired ? { onSessionExpired } : {})}
          requestOptions={requestOptions}
          title={t('classes.groups.newTitle')}
        />
      ) : null}

      {editingGroup ? (
        <GroupFormModal
          apiBaseUrl={apiBaseUrl}
          {...(client ? { client } : {})}
          group={editingGroup}
          onClose={() => {
            setEditingGroup(null);
          }}
          onSaved={async () => {
            setEditingGroup(null);
            await refreshGroups();
          }}
          {...(onSessionExpired ? { onSessionExpired } : {})}
          requestOptions={requestOptions}
          title={t('classes.groups.editTitle')}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group create / edit form
// ---------------------------------------------------------------------------

interface GroupFormModalProps {
  apiBaseUrl: string | null;
  client?: ClassesClient;
  group?: SubjectGroupView;
  requestOptions: () => ClassesRequestOptions;
  title: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onSessionExpired?: () => void;
}

function GroupFormModal({
  apiBaseUrl,
  client,
  group,
  requestOptions,
  title,
  onClose,
  onSaved,
  onSessionExpired,
}: GroupFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(group?.name ?? '');
  const [nameEn, setNameEn] = useState(group?.nameEn ?? '');
  const [nameAr, setNameAr] = useState(group?.nameAr ?? '');
  const [displayOrder, setDisplayOrder] = useState(String(group?.displayOrder ?? 1));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (name.trim().length < 2) {
      setErrorKey('classes.groups.validation');
      return;
    }

    const order = Number.parseInt(displayOrder, 10);
    if (Number.isNaN(order) || order < 1) {
      setErrorKey('classes.groups.validation');
      return;
    }

    setIsSubmitting(true);
    setErrorKey(null);

    try {
      if (group) {
        const input: UpdateSubjectGroupRequest = {
          name: name.trim(),
          nameEn: nameEn.trim() || null,
          nameAr: nameAr.trim() || null,
          displayOrder: order,
          recordVersion: group.recordVersion,
        };

        if (client?.updateSubjectGroup) {
          await client.updateSubjectGroup(group.id, input, requestOptions());
        } else {
          await updateSubjectGroupRequest(apiBaseUrl ?? '', group.id, input, requestOptions());
        }
      } else {
        const input: CreateSubjectGroupRequest = {
          name: name.trim(),
          nameEn: nameEn.trim() || null,
          nameAr: nameAr.trim() || null,
          displayOrder: order,
        };

        if (client?.createSubjectGroup) {
          await client.createSubjectGroup(input, requestOptions());
        } else {
          await createSubjectGroupRequest(apiBaseUrl ?? '', input, requestOptions());
        }
      }

      await onSaved();
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveClassesErrorMessageKey(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell closeLabel={t('classes.cancel')} onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-slate-800">{t('classes.groups.name')} *</span>
          <input
            className={formInputClassName}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder={t('classes.groups.namePlaceholder')}
            value={name}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {t('classes.groups.nameEn')}
            </span>
            <input
              className={formInputClassName}
              onChange={(event) => {
                setNameEn(event.target.value);
              }}
              placeholder="Ex. Science subjects"
              value={nameEn}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {t('classes.groups.nameAr')}
            </span>
            <input
              className={formInputClassName}
              dir="rtl"
              onChange={(event) => {
                setNameAr(event.target.value);
              }}
              placeholder="المواد العلمية"
              value={nameAr}
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-slate-800">
            {t('classes.groups.displayOrder')} *
          </span>
          <input
            className={formInputClassName}
            max={200}
            min={1}
            onChange={(event) => {
              setDisplayOrder(event.target.value);
            }}
            type="number"
            value={displayOrder}
          />
        </label>

        {errorKey ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700"
            role="alert"
          >
            {t(errorKey)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <ModalCancelButton label={t('classes.cancel')} onClose={onClose} />
          <button
            className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t('classes.saving') : t('classes.save')}
          </button>
        </div>
      </form>
    </ModalShell>
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
