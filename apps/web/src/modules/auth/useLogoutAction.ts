import { useState } from 'react';
import { logout as logoutWithApi, type AuthRequestOptions } from './authApi';
import { resolveAuthErrorMessageKey } from './authErrors';

export type LogoutClient = (apiBaseUrl: string, options?: AuthRequestOptions) => Promise<void>;

export interface UseLogoutActionOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  logoutClient?: LogoutClient;
  onLoggedOut: () => void;
}

/** Runs server logout first so refresh cookies are revoked before the UI resets. */
export function useLogoutAction({
  apiBaseUrl,
  capabilityToken,
  logoutClient = logoutWithApi,
  onLoggedOut,
}: UseLogoutActionOptions) {
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!apiBaseUrl) {
      setErrorKey('auth.errors.apiUnavailable');
      return;
    }

    setErrorKey(null);
    setIsSubmitting(true);

    try {
      if (capabilityToken) {
        await logoutClient(apiBaseUrl, { capabilityToken });
      } else {
        await logoutClient(apiBaseUrl);
      }

      onLoggedOut();
    } catch (error) {
      setErrorKey(resolveAuthErrorMessageKey(error, 'auth.errors.logoutFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    errorKey,
    isSubmitting,
    submit,
  };
}
