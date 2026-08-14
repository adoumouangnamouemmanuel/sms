import type { AuthTokenResponse, LoginRequest } from '@edutrack/shared';
import { useMemo, useState, type SyntheticEvent } from 'react';
import { login as loginWithApi, type AuthRequestOptions } from './authApi';
import { resolveAuthErrorMessageKey } from './authErrors';

export type LoginFormField = 'schoolCode' | 'username' | 'password';
export type LoginFormErrors = Partial<Record<LoginFormField, string>>;
export type LoginFormStatus = 'idle' | 'submitting' | 'success';
export type LoginClient = (
  apiBaseUrl: string,
  input: LoginRequest,
  options?: AuthRequestOptions
) => Promise<AuthTokenResponse>;

export interface UseLoginFormOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  loginClient?: LoginClient;
  onAuthenticated: (session: AuthTokenResponse) => void;
}

const initialValues: LoginRequest = {
  schoolCode: '',
  username: '',
  password: '',
};

/** Owns login form state while keeping token storage inside the auth API module. */
export function useLoginForm({
  apiBaseUrl,
  capabilityToken,
  loginClient = loginWithApi,
  onAuthenticated,
}: UseLoginFormOptions) {
  const [values, setValues] = useState<LoginRequest>(initialValues);
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  const [status, setStatus] = useState<LoginFormStatus>('idle');
  const normalizedValues = useMemo(() => normalizeLoginValues(values), [values]);
  const isSubmitting = status === 'submitting';

  function updateField(field: LoginFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setSubmitErrorKey(null);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setSubmitErrorKey('auth.errors.apiUnavailable');
      return;
    }

    const validationErrors = validateLoginForm(normalizedValues);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitErrorKey(null);
      return;
    }

    setStatus('submitting');
    setSubmitErrorKey(null);

    try {
      const session = capabilityToken
        ? await loginClient(apiBaseUrl, normalizedValues, { capabilityToken })
        : await loginClient(apiBaseUrl, normalizedValues);
      setStatus('success');
      onAuthenticated(session);
    } catch (error) {
      setStatus('idle');
      setSubmitErrorKey(resolveAuthErrorMessageKey(error));
    }
  }

  return {
    errors,
    isSubmitting,
    submit,
    submitErrorKey,
    updateField,
    values,
  };
}

export function normalizeLoginValues(values: LoginRequest): LoginRequest {
  return {
    schoolCode: values.schoolCode.trim(),
    username: values.username.trim(),
    password: values.password,
  };
}

export function validateLoginForm(values: LoginRequest): LoginFormErrors {
  const errors: LoginFormErrors = {};

  if (!values.schoolCode) {
    errors.schoolCode = 'auth.validation.schoolCodeRequired';
  }

  if (!values.username) {
    errors.username = 'auth.validation.usernameRequired';
  }

  if (!values.password) {
    errors.password = 'auth.validation.passwordRequired';
  }

  return errors;
}

function clearFieldError(errors: LoginFormErrors, field: LoginFormField): LoginFormErrors {
  if (!(field in errors)) {
    return errors;
  }

  const nextErrors = { ...errors };

  if (field === 'schoolCode') {
    delete nextErrors.schoolCode;
  } else if (field === 'username') {
    delete nextErrors.username;
  } else {
    delete nextErrors.password;
  }

  return nextErrors;
}
