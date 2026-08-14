import type { DesktopDeploymentStatus } from '../../desktopStatus';

export interface AuthRuntime {
  apiBaseUrl: string | null;
  capabilityToken?: string;
}

/** Resolves the local auth runtime from Tauri first, then Vite dev configuration. */
export function resolveAuthRuntime(
  desktopStatus: DesktopDeploymentStatus | null,
  envApiBaseUrl?: string
): AuthRuntime {
  const capabilityToken = normalizeCapabilityToken(desktopStatus?.capabilityToken);

  return {
    apiBaseUrl:
      normalizeApiBaseUrl(desktopStatus?.apiUrl) ??
      normalizeApiBaseUrl(envApiBaseUrl ?? readViteAuthApiBaseUrl()),
    ...(capabilityToken ? { capabilityToken } : {}),
  };
}

/** Resolves the trusted local API URL exposed by Tauri or an explicit Vite dev override. */
export function resolveAuthApiBaseUrl(
  desktopStatus: DesktopDeploymentStatus | null,
  envApiBaseUrl?: string
) {
  return resolveAuthRuntime(desktopStatus, envApiBaseUrl).apiBaseUrl;
}

export function normalizeApiBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function normalizeCapabilityToken(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || undefined;
}

function readViteAuthApiBaseUrl() {
  const value: unknown = import.meta.env.VITE_EDUTRACK_API_URL;

  return typeof value === 'string' ? value : undefined;
}
