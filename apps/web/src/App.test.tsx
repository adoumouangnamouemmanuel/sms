import { APP_NAME } from '@edutrack/shared';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './i18n';
import { App } from './App';
import { readDesktopDeploymentStatus } from './desktopStatus';

vi.mock('./desktopStatus', () => ({
  readDesktopDeploymentStatus: vi.fn(),
}));

describe('App', () => {
  const readDeploymentStatus = vi.mocked(readDesktopDeploymentStatus);

  beforeEach(() => {
    vi.useRealTimers();
    readDeploymentStatus.mockReset();
    readDeploymentStatus.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the localized Version 1 shell', () => {
    render(<App />);

    expect(screen.getAllByRole('heading', { level: 1, name: APP_NAME }).length).toBeGreaterThan(0);
    expect(screen.getByText('Bienvenue sur EduTrack Africa')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Connexion du personnel' })
    ).toBeInTheDocument();
    expect(screen.queryByText('SQLite local uniquement')).not.toBeInTheDocument();
  });

  it('polls Tauri deployment status until the sidecar is ready', async () => {
    vi.useFakeTimers();
    readDeploymentStatus
      .mockResolvedValueOnce({
        runtime: 'tauri',
        sidecarStatus: 'starting',
        databaseReady: false,
      })
      .mockResolvedValueOnce({
        runtime: 'tauri',
        sidecarStatus: 'ready',
        apiUrl: 'http://127.0.0.1:49152',
        capabilityToken: 'local-capability-token',
        databaseReady: true,
      });

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Connexion au service local...')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText('Service local prêt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });
});
