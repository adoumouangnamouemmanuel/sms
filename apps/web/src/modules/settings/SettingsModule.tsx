import type {
  PublicAuthUser,
  SetupSchoolProfileRequest,
  SetupStateResponse,
} from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveSchoolProfile } from '../setup/setupApi';
import { resolveSetupErrorMessageKey } from '../setup/setupErrors';
import { createProfileDraft } from '../setup/setupSteps';
import { formInputClassName } from '../people/ui';

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">{t('settings.title')}</h1>
        <p className="mt-1 text-[13px] font-semibold text-slate-500">{t('settings.subtitle')}</p>
      </div>

      {/* School profile */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-sm font-black text-white shadow-sm">
              {(school.shortName ?? school.name).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
                {t('settings.profile.title')}
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                {t('settings.profile.code', { code: school.code })}
              </p>
            </div>
          </div>
          {!isEditing && (
            <button
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setErrorKey(null);
                setIsEditing(true);
              }}
              type="button"
            >
              {t('settings.profile.edit')}
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
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
                {t(errorKey)}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-500 hover:bg-slate-50"
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
                className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <InfoRow label={t('settings.profile.name')} value={school.name} />
            <InfoRow label={t('settings.profile.city')} value={school.city ?? '—'} />
            <InfoRow label={t('settings.profile.address')} value={school.address ?? '—'} />
            <InfoRow label={t('settings.profile.phone')} value={school.phone ?? '—'} />
            <InfoRow label={t('settings.profile.email')} value={school.email ?? '—'} />
            <InfoRow
              label={t('settings.profile.ministryCode')}
              value={school.ministryCode ?? '—'}
            />
            <InfoRow label={t('settings.profile.motto')} value={school.motto ?? '—'} />
            <InfoRow label={t('settings.profile.shortName')} value={school.shortName ?? '—'} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Calendar */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-black uppercase tracking-wide text-slate-800">
            {t('settings.calendar.title')}
          </h2>
          <div className="space-y-4">
            <InfoRow
              label={t('settings.calendar.academicYear')}
              value={setupState.academicYear?.label ?? '—'}
            />
            <InfoRow
              label={t('settings.calendar.termSystem')}
              value={t(`settings.calendar.termSystems.${setupState.termSystem ?? 'TRIMESTER'}`)}
            />
            {setupState.terms.map((term) => (
              <InfoRow
                key={term.id}
                label={`${term.label}${term.isCurrent ? ` · ${t('settings.calendar.current')}` : ''}`}
                value={`${formatDate(term.startDate)} → ${formatDate(term.endDate)}`}
              />
            ))}
            <p className="text-[11px] font-semibold text-slate-400">
              {t('settings.calendar.hint')}
            </p>
          </div>
        </section>

        {/* System */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-black uppercase tracking-wide text-slate-800">
            {t('settings.system.title')}
          </h2>
          <div className="space-y-4">
            <InfoRow label={t('settings.system.locale')} value={school.locale} />
            <InfoRow label={t('settings.system.currency')} value={school.currency} />
            <InfoRow label={t('settings.system.timezone')} value={school.timezone} />
            <InfoRow label={t('settings.system.country')} value={school.country} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Modules */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-black uppercase tracking-wide text-slate-800">
            {t('settings.modules.title')}
          </h2>
          <ul className="space-y-2.5">
            {enabledModules.map((module) => (
              <li className="flex items-center gap-2.5" key={module.id}>
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500"
                >
                  <svg
                    className="h-2.5 w-2.5 text-white"
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
                <span className="text-[13px] font-bold text-slate-700">
                  {t(`setup.modules.${module.moduleName}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Session */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-black uppercase tracking-wide text-slate-800">
            {t('settings.session.title')}
          </h2>
          <div className="space-y-4">
            <InfoRow label={t('settings.session.user')} value={user.username} />
            <InfoRow label={t('settings.session.role')} value={t(`auth.roles.${user.role}`)} />
            {/* TODO(roadmap §Users & permissions): real account management
                (invite, deactivate, reset password for other users) ships with
                the dedicated module. */}
            <p className="text-[11px] font-semibold text-slate-400">{t('settings.session.hint')}</p>
          </div>
        </section>
      </div>

      {saved && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[13px] font-bold text-teal-700">
          {t('settings.saved')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

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
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-slate-800">{label}</span>
      <input
        className={formInputClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      />
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold text-slate-800">{value}</p>
    </div>
  );
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
