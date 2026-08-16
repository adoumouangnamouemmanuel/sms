import type { RecentAuditEvent } from '@edutrack/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchClassDistribution,
  fetchDashboardCounts,
  fetchRecentActivity,
  type ClassDistributionItem,
  type DashboardCounts,
  type DashboardRequestOptions,
} from './dashboardApi';

export interface DashboardClient {
  fetchCounts: (options?: DashboardRequestOptions) => Promise<DashboardCounts>;
  fetchClassDistribution: (
    academicYearId: string | undefined,
    options?: DashboardRequestOptions
  ) => Promise<ClassDistributionItem[]>;
  fetchRecentActivity: (options?: DashboardRequestOptions) => Promise<RecentAuditEvent[]>;
}

export interface UseDashboardStateOptions {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  academicYearId?: string | undefined;
  client?: DashboardClient;
}

export interface DashboardState {
  counts: DashboardCounts | null;
  classDistribution: ClassDistributionItem[];
  recentActivity: RecentAuditEvent[];
  errorKey: string | null;
  isLoading: boolean;
  /** True when a call failed with an invalid access token. */
  isSessionExpired: boolean;
  load: () => Promise<void>;
}

export function useDashboardState({
  apiBaseUrl,
  capabilityToken,
  academicYearId,
  client,
}: UseDashboardStateOptions): DashboardState {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [classDistribution, setClassDistribution] = useState<ClassDistributionItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentAuditEvent[]>([]);
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
      const tokenOptions = capabilityToken ? { capabilityToken } : {};
      const next = client
        ? {
            counts: await client.fetchCounts(tokenOptions),
            distribution: await client.fetchClassDistribution(academicYearId, tokenOptions),
          }
        : {
            counts: await fetchDashboardCounts(apiBaseUrl ?? '', tokenOptions),
            distribution: await fetchClassDistribution(
              apiBaseUrl ?? '',
              academicYearId,
              tokenOptions
            ),
          };

      setCounts(next.counts);
      setClassDistribution(next.distribution);

      // The activity timeline is secondary: its failure must not discard the
      // counts and distribution that already loaded.
      try {
        const activity = client
          ? await client.fetchRecentActivity(tokenOptions)
          : await fetchRecentActivity(apiBaseUrl ?? '', tokenOptions);

        setRecentActivity(activity);
      } catch (activityError) {
        if (isInvalidAccessToken(activityError)) {
          setIsSessionExpired(true);
          return;
        }

        setRecentActivity([]);
      }
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        setIsSessionExpired(true);
        return;
      }

      setErrorKey('dashboard.errors.unavailable');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, capabilityToken, academicYearId, client]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [load]);

  return { counts, classDistribution, recentActivity, errorKey, isLoading, isSessionExpired, load };
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}
