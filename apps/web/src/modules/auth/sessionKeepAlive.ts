import { useCallback, useEffect, useRef } from 'react';
import { refreshSession } from './authApi';
import { getAccessTokenExpiresAt } from './authSession';

/**
 * Keeps the in-memory access token alive by refreshing it shortly before it
 * expires (the refresh token lives in an httpOnly cookie, so this is silent).
 *
 * Previously nothing refreshed the access token, so any request made more
 * than 15 minutes after login returned INVALID_ACCESS_TOKEN and the app
 * logged the user out mid-flow (e.g. saving a subject group during setup).
 * This hook re-arms a timer from the token's own expiry on every refresh, so
 * a long session — the setup wizard included — never trips over an expired
 * token. If a refresh itself fails with a real session error, the caller's
 * onSessionExpired runs; transient service failures retry on the next tick.
 */
export function useSessionKeepAlive({
  apiBaseUrl,
  capabilityToken,
  enabled = true,
  onSessionExpired,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  enabled?: boolean;
  onSessionExpired: () => void;
}) {
  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!apiBaseUrl) {
      return false;
    }

    try {
      await refreshSession(apiBaseUrl, {
        ...(capabilityToken ? { capabilityToken } : {}),
      });
      return true;
    } catch (error) {
      // A real session loss surfaces as INVALID_REFRESH_SESSION / MISSING_
      // REFRESH_SESSION. Anything else (sidecar restarting, offline) is
      // transient and must NOT log the user out - the timer backs off and
      // retries.
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'INVALID_REFRESH_SESSION' || code === 'MISSING_REFRESH_SESSION') {
        onSessionExpiredRef.current();
        return false;
      }
      return false;
    }
  }, [apiBaseUrl, capabilityToken]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let handle: number | undefined;
    let cancelled = false;

    const scheduleNext = (lastRefreshSucceeded = true) => {
      if (cancelled) {
        return;
      }

      const expiresAt = getAccessTokenExpiresAt();
      if (expiresAt === null) {
        return; // Not logged in (or logged out); nothing to keep alive.
      }

      const remainingMs = Date.parse(expiresAt) - Date.now();
      // Refresh with a 60s safety margin. A machine that slept through the
      // deadline fires this overdue timeout immediately on wake (remainingMs
      // is negative, so the delay clamps to 0). After a transient failure,
      // back off 30s instead of re-firing in a tight loop.
      const delayMs = lastRefreshSucceeded ? Math.max(remainingMs - 60_000, 0) : 30_000;
      handle = window.setTimeout(() => {
        void refresh().then((succeeded) => {
          scheduleNext(succeeded);
        });
      }, delayMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (handle !== undefined) {
        window.clearTimeout(handle);
      }
    };
  }, [enabled, refresh]);
}
