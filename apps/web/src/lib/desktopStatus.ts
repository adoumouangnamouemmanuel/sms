export interface DesktopDeploymentStatus {
  runtime: 'tauri';
  sidecarStatus: 'starting' | 'ready' | 'failed' | 'stopped';
  apiUrl?: string;
  capabilityToken?: string;
  databasePath?: string;
  databaseReady: boolean;
  error?: string;
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export async function readDesktopDeploymentStatus() {
  if (!('__TAURI_INTERNALS__' in (window as TauriWindow))) {
    return null;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<DesktopDeploymentStatus>('deployment_status');
}
