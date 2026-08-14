import type { SetupSchoolProfileRequest } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';

export interface SetupProfileStepProps {
  draft: SetupSchoolProfileRequest;
  isSaving: boolean;
  onChange: (field: keyof SetupSchoolProfileRequest, value: string) => void;
  onSubmit: () => void;
}

export function SetupProfileStep({ draft, isSaving, onChange, onSubmit }: SetupProfileStepProps) {
  const { t } = useTranslation();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
        <SetupField
          autoFocus
          label={t('setup.profile.name')}
          name="name"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.name')}
          required
          value={draft.name}
        />
        <SetupField
          label={t('setup.profile.shortName')}
          name="shortName"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.shortName')}
          value={draft.shortName ?? ''}
        />
        <SetupField
          label={t('setup.profile.city')}
          name="city"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.city')}
          required
          value={draft.city}
        />
        <SetupField
          label={t('setup.profile.ministryCode')}
          name="ministryCode"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.ministryCode')}
          value={draft.ministryCode ?? ''}
        />
        <SetupField
          className="md:col-span-2"
          label={t('setup.profile.address')}
          name="address"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.address')}
          value={draft.address ?? ''}
        />
        <SetupField
          label={t('setup.profile.phone')}
          name="phone"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.phone')}
          type="tel"
          value={draft.phone ?? ''}
        />
        <SetupField
          label={t('setup.profile.email')}
          name="email"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.email')}
          type="email"
          value={draft.email ?? ''}
        />

        {/* Store only a persistent logo URL/path until local file storage is implemented. */}
        <SetupField
          className="md:col-span-2"
          label={t('setup.profile.logoUrl')}
          name="logoUrl"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.logoUrl')}
          type="url"
          value={draft.logoUrl ?? ''}
        />
        <SetupField
          className="md:col-span-2"
          label={t('setup.profile.motto')}
          name="motto"
          onChange={onChange}
          placeholder={t('setup.profile.placeholders.motto')}
          value={draft.motto ?? ''}
        />
      </div>

      <div className="pt-1">
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
      </div>
    </form>
  );
}

interface SetupFieldProps {
  autoFocus?: boolean;
  className?: string;
  label: string;
  name: keyof SetupSchoolProfileRequest;
  onChange: (field: keyof SetupSchoolProfileRequest, value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'email' | 'tel' | 'text' | 'url';
  value: string;
}

function SetupField({
  autoFocus,
  className,
  label,
  name,
  onChange,
  placeholder,
  required,
  type = 'text',
  value,
}: SetupFieldProps) {
  return (
    <label className={`flex flex-col gap-2 ${className ?? ''}`}>
      <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
        {label}
      </span>
      <input
        autoFocus={autoFocus}
        className="h-[50px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
        name={name}
        onChange={(event) => {
          onChange(name, event.target.value);
        }}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

export function WizardPrimaryButton({ isSaving, label }: { isSaving: boolean; label: string }) {
  return (
    <button
      className="inline-flex h-[50px] min-w-[200px] cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-teal-700 to-teal-600 px-6 text-sm font-bold text-white shadow-[0_4px_14px_rgba(15,118,110,0.35)] transition-all hover:from-teal-800 hover:to-teal-700 hover:shadow-[0_6px_20px_rgba(15,118,110,0.45)] focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
      disabled={isSaving}
      type="submit"
    >
      {isSaving ? (
        <svg
          className="mr-2 h-4 w-4 animate-spin text-white"
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      {label}
    </button>
  );
}
