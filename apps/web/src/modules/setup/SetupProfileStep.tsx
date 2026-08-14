import { setupSchoolProfileRequestSchema, type SetupSchoolProfileRequest } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SetupProfileStepProps {
  draft: SetupSchoolProfileRequest;
  isSaving: boolean;
  onChange: (field: keyof SetupSchoolProfileRequest, value: string) => void;
  onSubmit: () => void;
}

export function SetupProfileStep({ draft, isSaving, onChange, onSubmit }: SetupProfileStepProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (field: keyof SetupSchoolProfileRequest, value: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
    onChange(field, value);
  };

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        const result = setupSchoolProfileRequestSchema.safeParse(draft);
        const fieldErrors: Record<string, string> = {};
        if (!result.success) {
          for (const issue of result.error.issues) {
            if (issue.path[0]) {
              fieldErrors[issue.path[0].toString()] = t('setup.errors.validation');
            }
          }
        }

        const page0Fields = ['name', 'shortName', 'city', 'ministryCode', 'address'];

        if (page === 0) {
          const hasPage0Error = page0Fields.some((f) => fieldErrors[f]);
          if (hasPage0Error) {
            setErrors(fieldErrors);
            return;
          }
          setErrors({});
          setPage(1);
        } else {
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
          }
          setErrors({});
          onSubmit();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-4">
        <h4 className="text-sm font-bold text-slate-900">
          {page === 0 ? t('setup.steps.profile.short') : 'Coordonnées & Image'}
        </h4>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Étape {page + 1} sur 2
        </span>
      </div>

      <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
        {page === 0 ? (
          <>
            <SetupField
              autoFocus
              error={errors.name}
              label={t('setup.profile.name')}
              name="name"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.name')}
              required
              value={draft.name}
            />
            <SetupField
              error={errors.shortName}
              label={t('setup.profile.shortName')}
              name="shortName"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.shortName')}
              value={draft.shortName ?? ''}
            />
            <SetupField
              error={errors.city}
              label={t('setup.profile.city')}
              name="city"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.city')}
              required
              value={draft.city}
            />
            <SetupField
              error={errors.ministryCode}
              label={t('setup.profile.ministryCode')}
              name="ministryCode"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.ministryCode')}
              value={draft.ministryCode ?? ''}
            />
            <SetupField
              className="md:col-span-2"
              error={errors.address}
              label={t('setup.profile.address')}
              name="address"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.address')}
              value={draft.address ?? ''}
            />
          </>
        ) : (
          <>
            <SetupField
              autoFocus
              error={errors.phone}
              label={t('setup.profile.phone')}
              name="phone"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.phone')}
              type="tel"
              value={draft.phone ?? ''}
            />
            <SetupField
              error={errors.email}
              label={t('setup.profile.email')}
              name="email"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.email')}
              type="email"
              value={draft.email ?? ''}
            />
            <SetupField
              error={errors.logoUrl}
              label={t('setup.profile.logoUrl')}
              name="logoUrl"
              onChange={handleFieldChange}
              placeholder="https://"
              type="url"
              value={draft.logoUrl ?? ''}
            />
            <SetupField
              className="md:col-span-2"
              error={errors.motto}
              label={t('setup.profile.motto')}
              name="motto"
              onChange={handleFieldChange}
              placeholder={t('setup.profile.placeholders.motto')}
              value={draft.motto ?? ''}
            />
          </>
        )}
      </div>

      <div className="flex gap-4 pt-1">
        {page === 1 ? (
          <WizardSecondaryButton
            label={t('setup.actions.back')}
            onClick={() => {
              setPage(0);
            }}
          />
        ) : null}
        <WizardPrimaryButton
          isSaving={isSaving}
          label={page === 0 ? t('setup.actions.continue') : t('setup.actions.saveAndContinue')}
        />
      </div>
    </form>
  );
}

interface SetupFieldProps {
  autoFocus?: boolean;
  className?: string;
  error?: string | undefined;
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
  error,
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
        className={`h-[50px] w-full cursor-text rounded-2xl border ${
          error
            ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-teal-500 focus:ring-teal-600/10'
        } px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-4`}
        name={name}
        onChange={(event) => {
          onChange(name, event.target.value);
        }}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      {error ? <span className="text-[13px] font-medium text-red-600">{error}</span> : null}
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

export function WizardSecondaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="inline-flex h-[50px] min-w-[140px] cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 active:scale-[0.98]"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
