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
  const mockClassesTotal = distribution.reduce((sum, level) => sum + level.classes, 0);
  const mockStudentsTotal = distribution.reduce((sum, level) => sum + level.students, 0);

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0f172a] via-[#0a1628] to-[#061020] p-7 text-white shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-teal-300">
              {setupState.academicYear?.label ?? ''}
              {currentTerm ? ` · ${currentTerm.label}` : ''}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {t('dashboard.greeting', { name: firstNameOf(user.username) })}
            </h1>
            <p className="mt-1 text-[13px] font-bold text-slate-300">
              {t('dashboard.subtitle', { school: setupState.school.name })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[12px] font-black text-white shadow-lg shadow-teal-950/40 transition hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              onClick={() => {
                onNavigate('STUDENTS');
              }}
              type="button"
            >
              {t('dashboard.actions.students')}
            </button>
            <button
              className="cursor-pointer rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              onClick={() => {
                onNavigate('TEACHERS');
              }}
              type="button"
            >
              {t('dashboard.actions.teachers')}
            </button>
          </div>
        </div>
      </section>

      {dashboard.errorKey ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700 shadow-sm">
          {t(dashboard.errorKey)}
        </p>
      ) : null}

      {/* ── KPI cards — real headcounts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<UsersIcon />}
          label={t('dashboard.kpis.students')}
          loading={dashboard.isLoading}
          footer={t('dashboard.kpis.archivedCount', { count: counts?.studentsArchived ?? 0 })}
          tone="teal"
          value={counts?.studentsActive}
        />
        <KpiCard
          icon={<TeacherIcon />}
          label={t('dashboard.kpis.teachers')}
          loading={dashboard.isLoading}
          footer={t('dashboard.kpis.archivedCount', { count: counts?.teachersArchived ?? 0 })}
          tone="indigo"
          value={counts?.teachersActive}
        />
        <KpiCard
          icon={<GuardianIcon />}
          label={t('dashboard.kpis.guardians')}
          loading={dashboard.isLoading}
          footer={t('dashboard.kpis.archivedCount', { count: counts?.guardiansArchived ?? 0 })}
          tone="sky"
          value={counts?.guardiansActive}
        />
        <KpiCard
          icon={<ArchiveIcon />}
          label={t('dashboard.kpis.archived')}
          loading={dashboard.isLoading}
          footer={t('dashboard.kpis.archivedTotal')}
          tone="slate"
          value={archivedTotal}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── Structure académique — real levels, simulated effectifs ────── */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-[13px] font-black uppercase tracking-wide text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <SchoolIcon />
              </span>
              {t('dashboard.structure.title')}
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                {t('dashboard.structure.levelsCount', { count: distribution.length })}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                {t('dashboard.structure.classesCount', { count: mockClassesTotal })}
              </span>
              <SimulationBadge />
            </div>
          </div>

          {distribution.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-[13px] font-bold text-slate-400">
              {t('dashboard.structure.empty')}
            </p>
          ) : (
            <ul className="space-y-4">
              {distribution.map((level) => {
                const max = Math.max(...distribution.map((item) => item.students), 1);
                return (
                  <li key={level.levelId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <p className="text-[12px] font-bold text-slate-700">{level.levelName}</p>
                      <p className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-500 ring-1 ring-slate-100">
                        {level.students}
                      </p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 via-teal-400 to-teal-300 transition-all"
                        style={{ width: `${String(Math.round((level.students / max) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-bold text-slate-300">
                      {t('dashboard.structure.classesShort', { count: level.classes })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-[11px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-teal-400" />
              {t('dashboard.structure.studentsSim', { count: mockStudentsTotal })}
            </span>
            {/* TODO(roadmap §Classes): replace simulated effectifs with real
                enrollment counts once the Classes module ships. */}
          </div>
        </section>

        {/* ── Activité récente — simulated timeline ──────────────────────── */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-[13px] font-black uppercase tracking-wide text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <ActivityIcon />
              </span>
              {t('dashboard.activity.title')}
            </h2>
            <SimulationBadge />
          </div>

          <ol className="relative space-y-4 before:absolute before:left-[13px] before:top-1 before:bottom-1 before:w-px before:bg-slate-100">
            {MOCK_RECENT_ACTIVITY.map((event, index) => {
              const tone = ACTIVITY_TONES[index % ACTIVITY_TONES.length] ?? ACTIVITY_TONES[0];
              return (
                <li className="relative flex gap-3" key={event.id}>
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`}
                  >
                    <ActivityDot />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[12px] font-bold leading-snug text-slate-700">
                      {t(event.labelKey)}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">{t(event.timeKey)}</p>
                  </div>
                </li>
              );
            })}
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
    icon: 'from-teal-500 to-teal-600 shadow-teal-500/30',
    text: 'text-teal-700',
  },
  indigo: {
    bar: 'from-indigo-500 to-indigo-300',
    icon: 'from-indigo-500 to-indigo-600 shadow-indigo-500/30',
    text: 'text-indigo-700',
  },
  sky: {
    bar: 'from-sky-500 to-sky-300',
    icon: 'from-sky-500 to-sky-600 shadow-sky-500/30',
    text: 'text-sky-700',
  },
  slate: {
    bar: 'from-slate-500 to-slate-300',
    icon: 'from-slate-600 to-slate-700 shadow-slate-500/30',
    text: 'text-slate-700',
  },
} as const;

function KpiCard({
  footer,
  icon,
  label,
  loading,
  tone,
  value,
}: {
  footer: string;
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  tone: keyof typeof KPI_TONES;
  value: number | undefined;
}) {
  const palette = KPI_TONES[tone];

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette.bar}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-slate-950">
            {loading ? '…' : (value ?? 0)}
          </p>
          <p className="mt-2 text-[10px] font-bold text-slate-300">{footer}</p>
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-105 ${palette.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_TONES = [
  'bg-teal-100 text-teal-600',
  'bg-indigo-100 text-indigo-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
] as const;

function ActivityDot() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
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

// Icons — 24×24, 2px stroke

const iconProps = {
  'aria-hidden': true,
  className: 'h-5 w-5',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2,
  viewBox: '0 0 24 24',
} as const;

function UsersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TeacherIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function GuardianIcon() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect height="5" width="22" x="1" y="3" rx="1" />
      <line x1="10" x2="14" y1="12" y2="12" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
