import type { SetupSchoolProfileRequest, SetupStateResponse } from '@edutrack/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName } from '../people/ui';
import { saveSchoolProfile } from '../setup/setupApi';
import { resolveSetupErrorMessageKey } from '../setup/setupErrors';
import { createProfileDraft } from '../setup/setupSteps';

/**
 * School-profile editor (roadmap §9.2) embedded in the Configuration area.
 * Same field set and persistence as the Settings screen and the wizard's
 * profile step (one shared `school` table, one setup endpoint), so the
 * profile the bulletins need is editable from the configuration hub.
 */
export function SchoolProfileSection({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  onSetupStateChange,
  onSessionExpired,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  /** Test seam: replaces the network save. */
  client?: { saveProfile: (input: SetupSchoolProfileRequest) => Promise<SetupStateResponse> };
  setupState: SetupStateResponse;
  onSetupStateChange?: (state: SetupStateResponse) => void;
  onSessionExpired?: () => void;
}) {
  const { t } = useTranslation();
  const school = setupState.school;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SetupSchoolProfileRequest>(() =>
    createProfileDraft(setupState)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const requestOptions = useCallback(
    () => ({
      ...(capabilityToken ? { capabilityToken } : {}),
    }),
    [capabilityToken]
  );

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
        : await saveSchoolProfile(apiBaseUrl ?? '', draft, requestOptions());

      onSetupStateChange?.(nextState);
      setDraft(createProfileDraft(nextState));
      setIsEditing(false);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpiredRef.current?.();
        return;
      }

      setErrorKey(resolveSetupErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateDraft = (patch: Partial<SetupSchoolProfileRequest>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  return (
    <section
      aria-labelledby="configuration-profile-title"
      className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-100/50">
            <BuildingIcon />
          </div>
          <div>
            <h2
              className="text-base font-black tracking-tight text-slate-900"
              id="configuration-profile-title"
            >
              {t('configuration.profile.title')}
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('configuration.profile.hint')}
            </p>
          </div>
        </div>
        {!isEditing ? (
          <button
            className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              setErrorKey(null);
              setSaved(false);
              setIsEditing(true);
            }}
            type="button"
          >
            {t('configuration.profile.edit')}
          </button>
        ) : null}
      </div>

      {saved ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-700 shadow-sm">
          <svg
            aria-hidden="true"
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
          {t('configuration.profile.saved')}
        </div>
      ) : null}

      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField
              label={t('settings.profile.name')}
              onChange={(value) => {
                updateDraft({ name: value });
              }}
              value={draft.name}
            />
            <ProfileField
              label={t('settings.profile.shortName')}
              onChange={(value) => {
                updateDraft({ shortName: value || null });
              }}
              value={draft.shortName ?? ''}
            />
            <ProfileField
              label={t('settings.profile.city')}
              onChange={(value) => {
                updateDraft({ city: value });
              }}
              value={draft.city}
            />
            <ProfileField
              label={t('settings.profile.phone')}
              onChange={(value) => {
                updateDraft({ phone: value || null });
              }}
              value={draft.phone ?? ''}
            />
            <ProfileField
              label={t('settings.profile.email')}
              onChange={(value) => {
                updateDraft({ email: value || null });
              }}
              value={draft.email ?? ''}
            />
            <ProfileField
              label={t('settings.profile.ministryCode')}
              onChange={(value) => {
                updateDraft({ ministryCode: value || null });
              }}
              value={draft.ministryCode ?? ''}
            />
          </div>
          <ProfileField
            label={t('settings.profile.motto')}
            onChange={(value) => {
              updateDraft({ motto: value || null });
            }}
            value={draft.motto ?? ''}
          />
          <ProfileField
            label={t('settings.profile.address')}
            onChange={(value) => {
              updateDraft({ address: value || null });
            }}
            value={draft.address ?? ''}
          />

          {errorKey ? (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
              <svg
                aria-hidden="true"
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

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
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
              {t('configuration.cancel')}
            </button>
            <button
              className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              {isSaving ? t('configuration.saving') : t('configuration.saveProfile')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-12 gap-y-2 sm:grid-cols-2">
          <ProfileRow label={t('settings.profile.name')} value={school.name} />
          <ProfileRow label={t('settings.profile.shortName')} value={school.shortName} />
          <ProfileRow label={t('settings.profile.city')} value={school.city} />
          <ProfileRow label={t('settings.profile.phone')} value={school.phone} />
          <ProfileRow label={t('settings.profile.email')} value={school.email} />
          <ProfileRow label={t('settings.profile.ministryCode')} value={school.ministryCode} />
          <ProfileRow label={t('settings.profile.motto')} value={school.motto} />
          <ProfileRow label={t('settings.profile.address')} value={school.address} />
        </div>
      )}
    </section>
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

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation();
  const isEmpty = !value || value.trim().length === 0;

  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        {isEmpty ? (
          <p className="text-[13px] font-bold italic text-slate-300">{t('settings.emptyValue')}</p>
        ) : (
          <p className="truncate text-[13px] font-black text-slate-800">{value}</p>
        )}
      </div>
    </div>
  );
}

function BuildingIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="16" width="14" x="5" y="4" rx="2" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </svg>
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
