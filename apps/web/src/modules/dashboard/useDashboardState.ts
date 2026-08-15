import { useCallback, useEffect, useState } from 'react';
import {
  fetchDashboardCounts,
  type DashboardCounts,
  type DashboardRequestOptions,
} from './dashboardApi';

export interface DashboardClient {
  fetchCounts: (options?: DashboardRequestOptions) => Promise<DashboardCounts>;
}

export interface UseDashboardStateOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: DashboardClient;
}

export interface DashboardState {
  counts: DashboardCounts | null;
  errorKey: string | null;
  isLoading: boolean;
  /** True when the counts call failed with an invalid access token. */
  isSessionExpired: boolean;
  load: () => Promise<void>;
}

export function useDashboardState({
  apiBaseUrl,
  capabilityToken,
  client,
}: UseDashboardStateOptions): DashboardState {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const load = useCallback(async () => {
    if (!apiBaseUrl && !client) {
      return;
    }

    setIsLoading(true);
    setErrorKey(null);
    setIsSessionExpired(false);

    try {
      const next = client
        ? await client.fetchCounts(capabilityToken ? { capabilityToken } : {})
        : await fetchDashboardCounts(apiBaseUrl ?? '', capabilityToken ? { capabilityToken } : {});

      setCounts(next);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        setIsSessionExpired(true);
        return;
      }

      setErrorKey('dashboard.errors.unavailable');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, capabilityToken, client]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [load]);

  return { counts, errorKey, isLoading, isSessionExpired, load };
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}
