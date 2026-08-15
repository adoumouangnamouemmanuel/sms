import type {
  PublicAuthUser,
  SetupSchoolProfileRequest,
  SetupStateResponse,
} from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName } from '../people/ui';
import { saveSchoolProfile } from '../setup/setupApi';
import { resolveSetupErrorMessageKey } from '../setup/setupErrors';
import { createProfileDraft } from '../setup/setupSteps';

export interface SettingsClient {
  saveProfile: (input: SetupSchoolProfileRequest) => Promise<SetupStateResponse>;
}

export interface SettingsModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: SettingsClient;
  setupState: SetupStateResponse;
  user: PublicAuthUser;
  onSetupStateChange?: (state: SetupStateResponse) => void;
  onSessionExpired?: () => void;
}

export function SettingsModule({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  user,
  onSetupStateChange,
  onSessionExpired,
}: SettingsModuleProps) {
  const { t } = useTranslation();
  const school = setupState.school;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SetupSchoolProfileRequest>(() =>
    createProfileDraft(setupState)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const enabledModules = setupState.enabledModules.filter((module) => module.isEnabled);

  const handleSave = async () => {
    if (!apiBaseUrl && !client) {
      setErrorKey('settings.errors.localService');
      return;
    }

    setIsSaving(true);
    setErrorKey(null);
    setSaved(false);

    try {
      const nextState = client
        ? await client.saveProfile(draft)
        : await saveSchoolProfile(apiBaseUrl ?? '', draft, {
            ...(capabilityToken ? { capabilityToken } : {}),
          });

      onSetupStateChange?.(nextState);
      setDraft(createProfileDraft(nextState));
      setIsEditing(false);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveSetupErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── School identity hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-2xl lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/20 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-[80px]"
        />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-teal-400 to-teal-600 text-3xl font-black text-white shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] ring-1 ring-white/20">
            {(school.shortName ?? school.name).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-300/80">
              {t('settings.hero.eyebrow')}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{school.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-300">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">
                {school.city ?? school.shortName ?? ''}
              </span>
              {school.ministryCode ? (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">
                  {school.ministryCode}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/15 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-teal-200 backdrop-blur-md shadow-[0_0_20px_-5px_rgba(45,212,191,0.3)]">
              <span aria-hidden="true" className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300"></span>
              </span>
              {t('settings.hero.status')}
            </span>
            <p className="font-mono text-xs font-bold text-slate-400/80">{school.code}</p>
          </div>
        </div>
      </section>

      {saved && (
        <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-700 shadow-sm">
          <svg
            className="h-5 w-5 shrink-0 text-teal-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('settings.saved')}
        </div>
      )}

      {/* ── School profile ───────────────────────────────────────────────── */}
      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <SectionTitle icon={<BuildingIcon />} title={t('settings.profile.title')} />
          {!isEditing && (
            <button
              className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setErrorKey(null);
                setIsEditing(true);
              }}
              type="button"
            >
              <span className="relative z-10">{t('settings.profile.edit')}</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField
                label={t('settings.profile.name')}
                onChange={(value) => {
                  setDraft({ ...draft, name: value });
                }}
                value={draft.name}
              />
              <ProfileField
                label={t('settings.profile.shortName')}
                onChange={(value) => {
                  setDraft({ ...draft, shortName: value || null });
                }}
                value={draft.shortName ?? ''}
              />
              <ProfileField
                label={t('settings.profile.city')}
                onChange={(value) => {
                  setDraft({ ...draft, city: value });
                }}
                value={draft.city}
              />
              <ProfileField
                label={t('settings.profile.phone')}
                onChange={(value) => {
                  setDraft({ ...draft, phone: value || null });
                }}
                value={draft.phone ?? ''}
              />
              <ProfileField
                label={t('settings.profile.email')}
                onChange={(value) => {
                  setDraft({ ...draft, email: value || null });
                }}
                value={draft.email ?? ''}
              />
              <ProfileField
                label={t('settings.profile.ministryCode')}
                onChange={(value) => {
                  setDraft({ ...draft, ministryCode: value || null });
                }}
                value={draft.ministryCode ?? ''}
              />
            </div>
            <ProfileField
              label={t('settings.profile.motto')}
              onChange={(value) => {
                setDraft({ ...draft, motto: value || null });
              }}
              value={draft.motto ?? ''}
            />
            <ProfileField
              label={t('settings.profile.address')}
              onChange={(value) => {
                setDraft({ ...draft, address: value || null });
              }}
              value={draft.address ?? ''}
            />

            {errorKey ? (
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
                {t(errorKey)}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  setIsEditing(false);
                  setDraft(createProfileDraft(setupState));
                  setErrorKey(null);
                }}
                type="button"
              >
                {t('settings.cancel')}
              </button>
              <button
                className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  void handleSave();
                }}
                type="button"
              >
                {isSaving ? t('settings.saving') : t('settings.save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-12 gap-y-2 sm:grid-cols-2">
            <DetailRow icon={<PinIcon />} label={t('settings.profile.city')} value={school.city} />
            <DetailRow
              icon={<MapIcon />}
              label={t('settings.profile.address')}
              value={school.address}
            />
            <DetailRow
              icon={<PhoneIcon />}
              label={t('settings.profile.phone')}
              value={school.phone}
            />
            <DetailRow
              icon={<MailIcon />}
              label={t('settings.profile.email')}
              value={school.email}
            />
            <DetailRow
              icon={<TagIcon />}
              label={t('settings.profile.ministryCode')}
              value={school.ministryCode}
            />
            <DetailRow
              icon={<QuoteIcon />}
              label={t('settings.profile.motto')}
              value={school.motto}
            />
            <DetailRow
              icon={<ShortNameIcon />}
              label={t('settings.profile.shortName')}
              value={school.shortName}
            />
            <DetailRow
              icon={<BuildingIcon />}
              label={t('settings.profile.name')}
              value={school.name}
            />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Calendar ────────────────────────────────────────────────────── */}
        <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <SectionTitle icon={<CalendarIcon />} title={t('settings.calendar.title')} />
          <div className="space-y-2">
            <DetailRow
              icon={<YearIcon />}
              label={t('settings.calendar.academicYear')}
              value={setupState.academicYear?.label ?? null}
            />
            <DetailRow
              icon={<ClockIcon />}
              label={t('settings.calendar.termSystem')}
              value={t(`settings.calendar.termSystems.${setupState.termSystem ?? 'TRIMESTER'}`)}
            />
            {setupState.terms.map((term) => (
              <DetailRow
                icon={<TermIcon />}
                key={term.id}
                label={`${term.label}${term.isCurrent ? ` · ${t('settings.calendar.current')}` : ''}`}
                value={`${formatDate(term.startDate)} → ${formatDate(term.endDate)}`}
              />
            ))}
            <div className="mt-6 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
              <p className="text-xs font-semibold leading-relaxed text-slate-500">
                {t('settings.calendar.hint')}
              </p>
            </div>
          </div>
        </section>

        {/* ── System ──────────────────────────────────────────────────────── */}
        <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <SectionTitle icon={<ChipIcon />} title={t('settings.system.title')} />
          <div className="space-y-2">
            <DetailRow
              icon={<GlobeIcon />}
              label={t('settings.system.locale')}
              value={school.locale}
            />
            <DetailRow
              icon={<CoinsIcon />}
              label={t('settings.system.currency')}
              value={school.currency}
            />
            <DetailRow
              icon={<ClockIcon />}
              label={t('settings.system.timezone')}
              value={school.timezone}
            />
            <DetailRow
              icon={<FlagIcon />}
              label={t('settings.system.country')}
              value={school.country}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Modules ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <SectionTitle icon={<ModulesIcon />} title={t('settings.modules.title')} />
          <ul className="space-y-3">
            {enabledModules.map((module) => (
              <li
                className="group flex items-center gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                key={module.id}
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500"
                >
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                  {t(`setup.modules.${module.moduleName}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Session & access ────────────────────────────────────────────── */}
        <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
          <SectionTitle icon={<LockIcon />} title={t('settings.session.title')} />
          <div className="space-y-6">
            <div className="group flex items-center gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:border-teal-200/60 hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-black text-white shadow-sm ring-1 ring-white/20">
                {getInitials(user.username)}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-black text-slate-900">{user.username}</p>
                <p className="mt-0.5 text-[12px] font-bold uppercase tracking-wider text-teal-600">
                  {t(`auth.roles.${user.role}`)}
                </p>
              </div>
            </div>
            {/* TODO(roadmap §Users & permissions): real account management
                (invite, deactivate, reset password for other users) ships with
                the dedicated module. */}
            <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
              <p className="text-xs font-semibold leading-relaxed text-slate-500">
                {t('settings.session.hint')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-100/50">
        {icon}
      </div>
      <h2 className="text-base font-black tracking-tight text-slate-900">{title}</h2>
    </div>
  );
}

function ProfileField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        className={`${formInputClassName} h-12 rounded-2xl border-slate-200/80 bg-white text-sm font-bold shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500 transition-colors hover:bg-slate-50 focus:hover:bg-white`}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      />
    </label>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  const { t } = useTranslation();
  const isEmpty = !value || value.trim().length === 0;

  return (
    <div className="group flex items-center gap-4 rounded-3xl border border-transparent p-2 transition-all hover:border-slate-200/60 hover:bg-slate-50/50">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200/80 transition-colors group-hover:bg-white group-hover:text-teal-600 group-hover:ring-teal-200/80">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">
          {label}
        </p>
        {isEmpty ? (
          <p className="text-[14px] font-bold italic text-slate-300">{t('settings.emptyValue')}</p>
        ) : (
          <p className="truncate text-[14px] font-black text-slate-800 group-hover:text-slate-950 transition-colors">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function getInitials(username: string): string {
  const parts = username.split(/[\s._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('fr-FR');
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}

// Icons - 24×24, 2px stroke

const iconProps = {
  'aria-hidden': true,
  className: 'h-4 w-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2,
  viewBox: '0 0 24 24',
} as const;

function BuildingIcon() {
  return (
    <svg {...iconProps}>
      <rect height="16" width="14" x="5" y="4" rx="2" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <path d="M3.6 9h16.8M12 3a13.6 13.6 0 0 1 0 14" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps}>
      <rect height="16" width="20" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  );
}

function ShortNameIcon() {
  return (
    <svg {...iconProps}>
      <rect height="14" width="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect height="18" width="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function YearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function TermIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg {...iconProps}>
      <rect height="14" width="14" x="5" y="5" rx="2" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 22V4c0-1.1.9-2 2-2h7v14H6" />
      <path d="M13 2h5c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2h-5z" />
      <path d="M4 6H2M4 10H2" />
    </svg>
  );
}

function ModulesIcon() {
  return (
    <svg {...iconProps}>
      <rect height="7" width="7" x="3" y="3" rx="1" />
      <rect height="7" width="7" x="14" y="3" rx="1" />
      <rect height="7" width="7" x="14" y="14" rx="1" />
      <rect height="7" width="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...iconProps}>
      <rect height="11" width="18" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
