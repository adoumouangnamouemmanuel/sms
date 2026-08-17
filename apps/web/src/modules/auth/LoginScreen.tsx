import type { PublicAuthUser } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ForgotPasswordNotice } from './ForgotPasswordNotice';
import { useLoginForm, type LoginClient, type LoginFormField } from './useLoginForm';
import { useLogoutAction, type LogoutClient } from './useLogoutAction';
import type { DesktopDeploymentStatus } from '../../lib/desktopStatus';

export interface LoginScreenProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  desktopStatus?: DesktopDeploymentStatus | null;
  loginClient?: LoginClient;
  onAuthenticated: (user: PublicAuthUser) => void;
  onLoggedOut: () => void;
  logoutClient?: LogoutClient;
  user: PublicAuthUser | null;
}

const fieldIds: Record<LoginFormField, string> = {
  schoolCode: 'school-code',
  username: 'username',
  password: 'password',
};

export function LoginScreen({
  apiBaseUrl,
  capabilityToken,
  desktopStatus,
  loginClient,
  logoutClient,
  onAuthenticated,
  onLoggedOut,
  user,
}: LoginScreenProps) {
  const { t } = useTranslation();
  const [isForgotPasswordNoticeOpen, setIsForgotPasswordNoticeOpen] = useState(false);
  const form = useLoginForm({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(loginClient ? { loginClient } : {}),
    onAuthenticated: (session) => {
      onAuthenticated(session.user);
    },
  });
  const logoutAction = useLogoutAction({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(logoutClient ? { logoutClient } : {}),
    onLoggedOut,
  });

  if (user) {
    return (
      <div className="w-full" aria-label={t('auth.sessionPanelLabel')}>
        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-teal-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          {t('auth.successTitle')}
        </h2>
        <p className="text-slate-500 mb-6 font-medium">{t('auth.sessionActive')}</p>

        <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-5 shadow-sm">
          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('auth.username')}
              </dt>
              <dd className="font-bold text-slate-900">{user.username}</dd>
            </div>
            <div className="w-full h-px bg-slate-200/60"></div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('auth.role')}
              </dt>
              <dd className="font-bold text-slate-900">{t(`auth.roles.${user.role}`)}</dd>
            </div>
          </dl>
        </div>

        {logoutAction.errorKey ? (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 flex-shrink-0 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p className="text-xs font-bold" role="alert">
              {t(logoutAction.errorKey)}
            </p>
          </div>
        ) : null}

        <button
          className="mt-5 w-full flex items-center justify-center h-[48px] border border-slate-200 bg-white text-slate-700 font-bold rounded-2xl transition-all shadow-sm hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
          disabled={!apiBaseUrl || logoutAction.isSubmitting}
          onClick={() => {
            void logoutAction.submit();
          }}
          type="button"
        >
          {logoutAction.isSubmitting ? t('auth.logout.submitting') : t('auth.logout.submit')}
        </button>
      </div>
    );
  }

  const renderServiceStatus = () => {
    if (desktopStatus === undefined) return null;

    if (apiBaseUrl) {
      return (
        <div className="flex justify-center mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50/50 border border-teal-100 shadow-sm text-[12px] font-medium text-teal-700">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.5)]"></span>
            {t('auth.serviceStatus.ready')}
          </div>
        </div>
      );
    }

    if (!desktopStatus || desktopStatus.sidecarStatus === 'starting') {
      return (
        <div className="flex justify-center mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/60 shadow-sm text-[12px] font-medium text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.5)]"></span>
            {t('auth.serviceStatus.connecting')}
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50/50 border border-red-100 shadow-sm text-[12px] font-medium text-red-600">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></span>
          {t('auth.serviceStatus.unavailable')}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full" aria-label={t('auth.loginPanelLabel')}>
      {isForgotPasswordNoticeOpen ? (
        <ForgotPasswordNotice
          onClose={() => {
            setIsForgotPasswordNoticeOpen(false);
          }}
        />
      ) : null}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5">
          {t('auth.title')}
        </h2>
        <p className="text-slate-500 text-sm font-medium">{t('auth.subtitle')}</p>
      </div>

      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(event) => {
          void form.submit(event);
        }}
      >
        <LoginField
          errorKey={form.errors.schoolCode ?? null}
          id={fieldIds.schoolCode}
          label={t('auth.schoolCode')}
          name="schoolCode"
          onChange={(value) => {
            form.updateField('schoolCode', value);
          }}
          placeholder={t('auth.schoolCodePlaceholder')}
          type="text"
          value={form.values.schoolCode}
          tooltip="Code unique fourni par l'administration de votre établissement."
        />
        <LoginField
          errorKey={form.errors.username ?? null}
          id={fieldIds.username}
          label={t('auth.username')}
          name="username"
          onChange={(value) => {
            form.updateField('username', value);
          }}
          placeholder={t('auth.usernamePlaceholder')}
          type="text"
          value={form.values.username}
          tooltip="Votre identifiant personnel (ex: dupont.j)."
        />
        <LoginField
          errorKey={form.errors.password ?? null}
          id={fieldIds.password}
          label={t('auth.password')}
          name="password"
          onChange={(value) => {
            form.updateField('password', value);
          }}
          placeholder={t('auth.passwordPlaceholder')}
          type="password"
          value={form.values.password}
          forgotPasswordLabel={t('auth.forgotPassword.link')}
          onForgotPassword={() => {
            setIsForgotPasswordNoticeOpen(true);
          }}
          showForgotPassword={true}
        />

        {form.submitErrorKey ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 flex-shrink-0 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p className="text-xs font-bold" role="alert">
              {t(form.submitErrorKey)}
            </p>
          </div>
        ) : null}

        <button
          className="mt-1 w-full flex items-center justify-center h-[50px] bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-bold rounded-2xl transition-all shadow-[0_4px_14px_rgba(15,118,110,0.35)] hover:shadow-[0_6px_20px_rgba(15,118,110,0.45)] focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-60 disabled:from-teal-700 disabled:to-teal-700 disabled:shadow-none disabled:text-white/80 disabled:cursor-not-allowed transform active:scale-[0.98]"
          disabled={!apiBaseUrl || form.isSubmitting}
          type="submit"
        >
          {form.isSubmitting ? (
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : null}
          {form.isSubmitting ? t('auth.submitting') : t('auth.submit')}
        </button>

        {renderServiceStatus()}
      </form>
    </div>
  );
}

interface LoginFieldProps {
  errorKey: string | null;
  id: string;
  label: string;
  name: LoginFormField;
  onChange: (value: string) => void;
  placeholder: string;
  type: 'password' | 'text';
  value: string;
  showForgotPassword?: boolean;
  forgotPasswordLabel?: string;
  onForgotPassword?: () => void;
  tooltip?: string;
}

function LoginField({
  errorKey,
  id,
  label,
  name,
  onChange,
  placeholder,
  type,
  value,
  forgotPasswordLabel,
  onForgotPassword,
  showForgotPassword,
  tooltip,
}: LoginFieldProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const errorId = `${id}-error`;
  const isPassword = name === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5"
        >
          {label}
          {tooltip && (
            <span
              className="cursor-help text-slate-300 hover:text-slate-500 transition-colors"
              title={tooltip}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </span>
          )}
        </label>
        {showForgotPassword && onForgotPassword && forgotPasswordLabel ? (
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[12px] font-bold text-teal-600 hover:text-teal-700 transition-colors"
          >
            {forgotPasswordLabel}
          </button>
        ) : null}
      </div>
      <div className="relative group">
        <input
          aria-describedby={errorKey ? errorId : undefined}
          aria-invalid={errorKey ? 'true' : 'false'}
          autoCapitalize={name === 'schoolCode' ? 'characters' : 'none'}
          autoComplete={isPassword ? 'current-password' : undefined}
          autoCorrect="off"
          id={id}
          name={name}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          required
          spellCheck={false}
          type={inputType}
          value={value}
          className={`w-full box-border h-[50px] px-4 bg-slate-50 border rounded-2xl text-[14px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:bg-white focus:ring-4 focus:ring-teal-600/10 focus:border-teal-500 ${
            errorKey
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30'
              : 'border-slate-200 hover:border-slate-300'
          } ${isPassword ? 'pr-11' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => {
              setShowPassword((current) => !current);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2 rounded-xl transition-colors focus:outline-none focus:bg-slate-100 hover:bg-slate-50"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}
      </div>
      {errorKey ? (
        <p className="text-red-500 text-[11px] font-bold mt-1" id={errorId}>
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}
