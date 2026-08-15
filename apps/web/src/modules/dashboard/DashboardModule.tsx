import type {
  PublicAuthUser,
  RecentAuditEvent,
  SchoolModuleName,
  SetupStateResponse,
} from '@edutrack/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
  const dashboard = useDashboardState({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
    academicYearId: setupState.academicYear?.id ?? undefined,
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
  const distribution = dashboard.classDistribution;
  const currentTerm = setupState.terms.find((term) => term.isCurrent);
  const classesTotal = distribution.reduce((sum, level) => sum + level.classes, 0);
  const studentsTotal = distribution.reduce((sum, level) => sum + level.students, 0);
  const hasStructure = distribution.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl lg:p-10">
        {/* Abstract shapes for premium feel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/20 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-[80px]"
        />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-teal-200 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500"></span>
              </span>
              {setupState.academicYear?.label ?? ''}
              {currentTerm ? ` · ${currentTerm.label}` : ''}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              {t('dashboard.greeting', { name: firstNameOf(user.username) })}
            </h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-400 sm:text-base sm:leading-relaxed">
              {t('dashboard.subtitle', { school: setupState.school.name })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-teal-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_40px_-10px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_60px_-15px_rgba(20,184,166,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              onClick={() => {
                onNavigate('STUDENTS');
              }}
              type="button"
            >
              <span className="relative z-10">{t('dashboard.actions.students')}</span>
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0,0_0] bg-no-repeat transition-[background-position_0s_ease] group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
            </button>
            <button
              className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
          <svg
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
          {t(dashboard.errorKey)}
        </div>
      ) : null}

      {/* ── KPI cards — real headcounts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Structure académique — real levels and effectifs ───────────── */}
        <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:col-span-2 lg:p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100/50">
                <SchoolIcon />
              </div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                {t('dashboard.structure.title')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200">
                {t('dashboard.structure.levelsCount', { count: distribution.length })}
              </span>
              <span className="inline-flex items-center rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200">
                {t('dashboard.structure.classesCount', { count: classesTotal })}
              </span>
            </div>
          </div>

          {!hasStructure ? (
            <div className="flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-8">
              <p className="text-sm font-bold text-slate-400">{t('dashboard.structure.empty')}</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {distribution.map((level) => {
                const max = Math.max(...distribution.map((item) => item.students), 1);
                return (
                  <li key={level.levelCode} className="group">
                    <div className="mb-2 flex items-end justify-between gap-4">
                      <p className="text-[13px] font-bold text-slate-700">{level.levelName}</p>
                      <div className="text-right">
                        <p className="text-lg font-black tabular-nums leading-none text-slate-900">
                          {level.students}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          {t('dashboard.structure.classesShort', { count: level.classes })}
                        </p>
                      </div>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100/80">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-1000 ease-out group-hover:bg-teal-400"
                        style={{ width: `${String(Math.round((level.students / max) * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-auto pt-6">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
              <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              {t('dashboard.structure.studentsEnrolled', { count: studentsTotal })}
            </div>
          </div>
        </section>

        {/* ── Activité récente — real audit events ───────────────────────── */}
        <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/50">
                <ActivityIcon />
              </div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                {t('dashboard.activity.title')}
              </h2>
            </div>
          </div>

          {dashboard.recentActivity.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-8">
              <p className="text-sm font-bold text-slate-400">{t('dashboard.activity.empty')}</p>
            </div>
          ) : (
            <ol className="relative space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              {dashboard.recentActivity.map((event, index) => {
                const tone = ACTIVITY_TONES[index % ACTIVITY_TONES.length] ?? ACTIVITY_TONES[0];
                return (
                  <li className="group relative flex gap-4" key={event.id}>
                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white transition-transform duration-300 group-hover:scale-110 ${tone}`}
                    >
                      <ActivityDot />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-[13px] font-bold leading-relaxed text-slate-700 transition-colors group-hover:text-slate-900">
                        {t(activityLabelKey(event.action))}
                        {event.actorUsername ? ` · ${event.actorUsername}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">
                        {formatActivityTime(event, i18n.language)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function activityLabelKey(action: string): string {
  const normalized = action.toLowerCase().replaceAll('_', '.');
  return `dashboard.activity.events.${normalized}`;
}

function formatActivityTime(event: RecentAuditEvent, language: string): string {
  const occurredAt = new Date(event.occurredAt);
  const now = new Date();

  if (Number.isNaN(occurredAt.getTime())) {
    return event.occurredAt;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEventDay = new Date(
    occurredAt.getFullYear(),
    occurredAt.getMonth(),
    occurredAt.getDate()
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfEventDay.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (dayDiff === 0) {
    return occurredAt.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  }

  return occurredAt.toLocaleDateString(language, { day: 'numeric', month: 'short' });
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
    wrapper: 'hover:border-teal-200',
    glow: 'bg-teal-400',
    iconWrapper: 'bg-gradient-to-br from-teal-50 to-teal-100/50 text-teal-600 ring-teal-200/50',
    trend: 'text-teal-700 bg-teal-50',
  },
  indigo: {
    wrapper: 'hover:border-indigo-200',
    glow: 'bg-indigo-400',
    iconWrapper:
      'bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 ring-indigo-200/50',
    trend: 'text-indigo-700 bg-indigo-50',
  },
  sky: {
    wrapper: 'hover:border-sky-200',
    glow: 'bg-sky-400',
    iconWrapper: 'bg-gradient-to-br from-sky-50 to-sky-100/50 text-sky-600 ring-sky-200/50',
    trend: 'text-sky-700 bg-sky-50',
  },
  slate: {
    wrapper: 'hover:border-slate-300',
    glow: 'bg-slate-400',
    iconWrapper: 'bg-gradient-to-br from-slate-50 to-slate-100/50 text-slate-600 ring-slate-200/50',
    trend: 'text-slate-700 bg-slate-100',
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
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] ${palette.wrapper}`}
    >
      <div
        className={`absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-15 ${palette.glow}`}
      />

      <div className="relative flex items-center justify-between gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 ${palette.iconWrapper}`}
        >
          {icon}
        </div>
        <p className="text-right text-[11px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </p>
      </div>

      <div className="relative mt-8">
        <div className="flex items-baseline gap-2">
          <p className="text-[40px] font-black tabular-nums leading-none tracking-tighter text-slate-900">
            {loading ? '…' : (value ?? 0)}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${palette.trend}`}
          >
            {footer}
          </span>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_TONES = [
  'bg-teal-50 text-teal-600',
  'bg-indigo-50 text-indigo-600',
  'bg-amber-50 text-amber-600',
  'bg-rose-50 text-rose-600',
] as const;

function ActivityDot() {
  return (
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Icons — 24×24, 2px stroke

function UsersIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
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
      className="h-6 w-6"
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
      className="h-6 w-6"
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
      className="h-6 w-6"
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

function SchoolIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
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

function ActivityIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
