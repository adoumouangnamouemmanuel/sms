import type { DesktopDeploymentStatus } from '../../desktopStatus';

/** Resolves the trusted local API URL exposed by Tauri or an explicit Vite dev override. */
export function resolveAuthApiBaseUrl(
  desktopStatus: DesktopDeploymentStatus | null,
  envApiBaseUrl?: string
) {
  return (
    normalizeApiBaseUrl(desktopStatus?.apiUrl) ??
    normalizeApiBaseUrl(envApiBaseUrl ?? readViteAuthApiBaseUrl())
  );
}

export function normalizeApiBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function readViteAuthApiBaseUrl() {
  const value: unknown = import.meta.env.VITE_EDUTRACK_API_URL;

  return typeof value === 'string' ? value : undefined;
}
