import type { SetupStateResponse } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassesClient } from './useClassesState';
import { ClassroomsView } from './ClassroomsView';
import { EnrolmentView } from './EnrolmentView';
import { LevelCurriculumView } from './LevelCurriculumView';
import { LevelsView } from './LevelsView';
import { SubjectGroupsView } from './SubjectGroupsView';
import { SubjectsView } from './SubjectsView';

export interface ClassesModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ClassesClient;
  setupState: SetupStateResponse;
  onSetupStateChange?: (state: SetupStateResponse) => void;
  onSessionExpired?: () => void;
}

export type ClassesTabId =
  'subjects' | 'classrooms' | 'enrolment' | 'levels' | 'curriculum' | 'groups';

export function ClassesModule({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  onSetupStateChange,
  onSessionExpired,
}: ClassesModuleProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ClassesTabId>('classrooms');

  const tabs: { id: ClassesTabId; label: string }[] = [
    { id: 'classrooms', label: t('classes.tabs.classrooms') },
    { id: 'subjects', label: t('classes.tabs.subjects') },
    { id: 'curriculum', label: t('classes.tabs.curriculum') },
    { id: 'groups', label: t('classes.tabs.groups') },
    { id: 'enrolment', label: t('classes.tabs.enrolment') },
    { id: 'levels', label: t('classes.tabs.levels') },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {t('classes.title')}
        </h1>
        <p className="text-sm font-semibold leading-relaxed text-slate-500">
          {t('classes.subtitle')}
        </p>
      </div>

      {/* Tab bar */}
      <div
        aria-label={t('classes.tabs.label')}
        className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm"
        role="tablist"
      >
        {tabs.map((item) => (
          <button
            aria-selected={tab === item.id}
            className={`cursor-pointer rounded-xl px-4 py-2 text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
              tab === item.id
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
            key={item.id}
            onClick={() => {
              setTab(item.id);
            }}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'classrooms' ? (
        <ClassroomsView
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          {...(onSessionExpired ? { onSessionExpired } : {})}
          setupState={setupState}
        />
      ) : tab === 'subjects' ? (
        <SubjectsView
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          {...(onSessionExpired ? { onSessionExpired } : {})}
        />
      ) : tab === 'curriculum' ? (
        <LevelCurriculumView
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          {...(onSessionExpired ? { onSessionExpired } : {})}
        />
      ) : tab === 'groups' ? (
        <SubjectGroupsView
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          {...(onSessionExpired ? { onSessionExpired } : {})}
        />
      ) : tab === 'enrolment' ? (
        <EnrolmentView
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          {...(onSessionExpired ? { onSessionExpired } : {})}
          setupState={setupState}
        />
      ) : (
        <LevelsView
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          setupState={setupState}
          {...(onSetupStateChange ? { onSetupStateChange } : {})}
          {...(onSessionExpired ? { onSessionExpired } : {})}
        />
      )}
    </div>
  );
}
