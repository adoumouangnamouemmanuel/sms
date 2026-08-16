import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { refreshSession } from '../../modules/auth/authApi';
import { clearAccessToken, rememberAccessToken } from '../../modules/auth/authSession';
import { useSessionKeepAlive } from '../../modules/auth/sessionKeepAlive';

vi.mock('../../modules/auth/authApi', () => ({
  refreshSession: vi.fn(),
}));

const apiBaseUrl = 'http://127.0.0.1:49152';

describe('session keep-alive (token refresh before expiry)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T10:00:00.000Z'));
  });

  afterEach(() => {
    clearAccessToken();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('refreshes before the token expires and keeps the session alive', async () => {
    // Token expires in 14 minutes: 10:14.
    rememberAccessToken('token-1', '2026-08-16T10:14:00.000Z');
    vi.mocked(refreshSession).mockResolvedValue({
      accessToken: 'token-2',
      accessTokenExpiresAt: '2026-08-16T10:29:00.000Z',
      refreshTokenExpiresAt: '2026-08-16T11:14:00.000Z',
      user: {
        id: 'user-1',
        schoolId: '00000000-0000-4000-8000-000000000001',
        username: 'directeur',
        role: 'SCHOOL_MASTER',
      },
    });

    const onSessionExpired = vi.fn();
    renderHook(() => {
      useSessionKeepAlive({ apiBaseUrl, enabled: true, onSessionExpired });
    });

    // 13 minutes in: still 1 minute before the 10:14 expiry - the timer
    // (10:14 - 60s) fires and refreshes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60_000);
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('does not log the user out on transient refresh failures', async () => {
    rememberAccessToken('token-1', '2026-08-16T10:14:00.000Z');
    vi.mocked(refreshSession).mockRejectedValue({
      code: 'LOCAL_SERVICE_UNAVAILABLE',
      message: 'Service indisponible.',
    });

    const onSessionExpired = vi.fn();
    renderHook(() => {
      useSessionKeepAlive({ apiBaseUrl, enabled: true, onSessionExpired });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60_000);
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('logs the user out only when the refresh session is really gone', async () => {
    rememberAccessToken('token-1', '2026-08-16T10:14:00.000Z');
    vi.mocked(refreshSession).mockRejectedValue({
      code: 'INVALID_REFRESH_SESSION',
      message: 'Session expirée.',
    });

    const onSessionExpired = vi.fn();
    renderHook(() => {
      useSessionKeepAlive({ apiBaseUrl, enabled: true, onSessionExpired });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60_000);
    });

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled or when no token is present', async () => {
    const onSessionExpired = vi.fn();
    renderHook(() => {
      useSessionKeepAlive({ apiBaseUrl, enabled: true, onSessionExpired });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20 * 60_000);
    });

    expect(refreshSession).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});
