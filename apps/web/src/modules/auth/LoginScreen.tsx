import type { PublicAuthUser } from '@edutrack/shared';
import { useTranslation } from 'react-i18next';
import { useLoginForm, type LoginClient, type LoginFormField } from './useLoginForm';

export interface LoginScreenProps {
  apiBaseUrl: string | null;
  loginClient?: LoginClient;
  onAuthenticated: (user: PublicAuthUser) => void;
  user: PublicAuthUser | null;
}

const fieldIds: Record<LoginFormField, string> = {
  schoolCode: 'school-code',
  username: 'username',
  password: 'password',
};

export function LoginScreen({ apiBaseUrl, loginClient, onAuthenticated, user }: LoginScreenProps) {
  const { t } = useTranslation();
  const form = useLoginForm({
    apiBaseUrl,
    ...(loginClient ? { loginClient } : {}),
    onAuthenticated: (session) => {
      onAuthenticated(session.user);
    },
  });

  if (user) {
    return (
      <section className="auth-card auth-card--success" aria-label={t('auth.sessionPanelLabel')}>
        <span className="auth-card-mark" aria-hidden="true" />
        <p className="auth-kicker">{t('auth.sessionActive')}</p>
        <h2>{t('auth.successTitle')}</h2>
        <dl className="auth-session-details">
          <div>
            <dt>{t('auth.username')}</dt>
            <dd>{user.username}</dd>
          </div>
          <div>
            <dt>{t('auth.role')}</dt>
            <dd>{t(`auth.roles.${user.role}`)}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="auth-card" aria-label={t('auth.loginPanelLabel')}>
      <span className="auth-card-mark" aria-hidden="true" />
      <div className="auth-heading">
        <p className="auth-kicker">{t('auth.phase')}</p>
        <h2>{t('auth.title')}</h2>
        <p>{t('auth.subtitle')}</p>
      </div>

      <form
        className="login-form"
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
        />

        {form.submitErrorKey ? (
          <p className="form-alert" role="alert">
            {t(form.submitErrorKey)}
          </p>
        ) : null}

        <button
          className="primary-action"
          disabled={!apiBaseUrl || form.isSubmitting}
          type="submit"
        >
          {form.isSubmitting ? t('auth.submitting') : t('auth.submit')}
        </button>

        {!apiBaseUrl ? <p className="form-note">{t('auth.apiUnavailable')}</p> : null}
      </form>
    </section>
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
}: LoginFieldProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const isPassword = name === 'password';

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
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
        type={type}
        value={value}
      />
      {errorKey ? (
        <p className="field-error" id={errorId}>
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}
