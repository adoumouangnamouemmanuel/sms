import type { PublicAuthUser, SchoolModuleName, SetupStateResponse } from '@edutrack/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buildMockClassDistribution, MOCK_RECENT_ACTIVITY } from './dashboardMock';
import { useDashboardState, type DashboardClient } from './useDashboardState';

export interface DashboardModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: DashboardClient;
  setupState: SetupStateResponse;
  user: PublicAuthUser;
  onNavigate: (module: SchoolModuleName) => void;
  onSessionExpired?: () => void;
}

export function DashboardModule({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  user,
  onNavigate,
  onSessionExpired,
}: DashboardModuleProps) {
  const { t } = useTranslation();
  const dashboard = useDashboardState({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });

  useEffect(() => {
    if (dashboard.isSessionExpired) {
      onSessionExpired?.();
    }
  }, [dashboard.isSessionExpired, onSessionExpired]);

  const counts = dashboard.counts;
  const archivedTotal =
    (counts?.studentsArchived ?? 0) +
    (counts?.teachersArchived ?? 0) +
    (counts?.guardiansArchived ?? 0);
  const distribution = buildMockClassDistribution(setupState.classLevels);
  const currentTerm = setupState.terms.find((term) => term.isCurrent);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-600">
            {setupState.academicYear?.label ?? ''}
            {currentTerm ? ` · ${currentTerm.label}` : ''}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            {t('dashboard.greeting', { name: firstNameOf(user.username) })}
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-slate-500">
            {t('dashboard.subtitle', { school: setupState.school.name })}
          </p>
        </div>
        {dashboard.errorKey ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            {t(dashboard.errorKey)}
          </p>
        ) : null}
      </div>

      {/* KPI cards — real headcounts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<UsersIcon />}
          label={t('dashboard.kpis.students')}
          loading={dashboard.isLoading}
          tone="teal"
          value={counts?.studentsActive}
        />
        <KpiCard
          icon={<TeacherIcon />}
          label={t('dashboard.kpis.teachers')}
          loading={dashboard.isLoading}
          tone="indigo"
          value={counts?.teachersActive}
        />
        <KpiCard
          icon={<GuardianIcon />}
          label={t('dashboard.kpis.guardians')}
          loading={dashboard.isLoading}
          tone="sky"
          value={counts?.guardiansActive}
        />
        <KpiCard
          icon={<ArchiveIcon />}
          label={t('dashboard.kpis.archived')}
          loading={dashboard.isLoading}
          tone="slate"
          value={archivedTotal}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Structure académique — real levels, simulated effectifs */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
              {t('dashboard.structure.title')}
            </h2>
            <SimulationBadge />
          </div>

          {distribution.length === 0 ? (
            <p className="text-[13px] font-semibold text-slate-400">
              {t('dashboard.structure.empty')}
            </p>
          ) : (
            <ul className="space-y-3.5">
              {distribution.map((level) => {
                const max = Math.max(...distribution.map((item) => item.students), 1);
                return (
                  <li key={level.levelId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="text-[12px] font-bold text-slate-700">{level.levelName}</p>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {t('dashboard.structure.meta', {
                          classes: level.classes,
                          students: level.students,
                        })}
                      </p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300"
                        style={{ width: `${String(Math.round((level.students / max) * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <QuickAction
              label={t('dashboard.actions.students')}
              onClick={() => {
                onNavigate('STUDENTS');
              }}
            />
            <QuickAction
              label={t('dashboard.actions.teachers')}
              onClick={() => {
                onNavigate('TEACHERS');
              }}
            />
          </div>
        </section>

        {/* Activité récente — simulated timeline */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
              {t('dashboard.activity.title')}
            </h2>
            <SimulationBadge />
          </div>

          <ol className="relative space-y-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-slate-100">
            {MOCK_RECENT_ACTIVITY.map((event) => (
              <li className="relative pl-6" key={event.id}>
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-teal-400 bg-white"
                />
                <p className="text-[12px] font-bold leading-snug text-slate-700">
                  {t(event.labelKey)}
                </p>
                <p className="text-[11px] font-semibold text-slate-400">{t(event.timeKey)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function firstNameOf(username: string): string {
  const first = username.split(/[\s._-]/).find(Boolean);
  return first ?? username;
}

const KPI_TONES = {
  teal: {
    bar: 'from-teal-500 to-teal-300',
    icon: 'from-teal-500/15 to-teal-500/5 text-teal-700 ring-teal-200/70',
  },
  indigo: {
    bar: 'from-indigo-500 to-indigo-300',
    icon: 'from-indigo-500/15 to-indigo-500/5 text-indigo-700 ring-indigo-200/70',
  },
  sky: {
    bar: 'from-sky-500 to-sky-300',
    icon: 'from-sky-500/15 to-sky-500/5 text-sky-700 ring-sky-200/70',
  },
  slate: {
    bar: 'from-slate-500 to-slate-300',
    icon: 'from-slate-500/15 to-slate-500/5 text-slate-700 ring-slate-200/70',
  },
} as const;

function KpiCard({
  icon,
  label,
  loading,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  tone: keyof typeof KPI_TONES;
  value: number | undefined;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${KPI_TONES[tone].bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-950">
            {loading ? '…' : (value ?? 0)}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${KPI_TONES[tone].icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SimulationBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {t('dashboard.simulation')}
    </span>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="cursor-pointer rounded-xl bg-slate-900 px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

// Icons (24×24, 2px stroke — same pattern as the shell nav)

function UsersIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
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
  );
}

function TeacherIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function GuardianIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect height="5" width="22" x="1" y="3" rx="1" />
      <line x1="10" x2="14" y1="12" y2="12" />
    </svg>
  );
}
