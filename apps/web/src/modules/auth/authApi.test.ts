import { SIDECAR_CAPABILITY_HEADER } from '@edutrack/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from './authApi';
import type { AuthApiError } from './authErrors';
import {
  clearAccessToken,
  createAuthHeaders,
  getAccessToken,
  getAccessTokenExpiresAt,
} from './authSession';

const sessionResponse = {
  success: true,
  data: {
    accessToken: 'access-token-1',
    accessTokenExpiresAt: '2026-08-13T10:15:00.000Z',
    refreshTokenExpiresAt: '2026-08-20T10:00:00.000Z',
    user: {
      id: '00000000-0000-4000-8000-000000000201',
      schoolId: '00000000-0000-4000-8000-000000000101',
      username: 'directeur',
      role: 'SCHOOL_MASTER',
    },
  },
};

describe('authApi', () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it('stores access tokens in module memory only after login', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');

    await login(
      'http://127.0.0.1:49152',
      {
        schoolCode: 'NDS-DEMO',
        username: 'directeur',
        password: 'correct-password',
      },
      createSuccessfulFetch()
    );

    expect(getAccessToken()).toBe('access-token-1');
    expect(getAccessTokenExpiresAt()).toBe('2026-08-13T10:15:00.000Z');
    expect(createAuthHeaders()).toEqual({ Authorization: 'Bearer access-token-1' });
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('clears the in-memory access token after logout', async () => {
    const fetcher = createSuccessfulFetch();

    await login(
      'http://127.0.0.1:49152',
      {
        schoolCode: 'NDS-DEMO',
        username: 'directeur',
        password: 'correct-password',
      },
      fetcher
    );
    await logout('http://127.0.0.1:49152', fetcher);

    expect(getAccessToken()).toBeNull();
    expect(createAuthHeaders()).toEqual({});
  });

  it('sends the sidecar capability header when logging out', async () => {
    const fetcher = vi.fn(createSuccessfulFetch());

    await login(
      'http://127.0.0.1:49152',
      {
        schoolCode: 'NDS-DEMO',
        username: 'directeur',
        password: 'correct-password',
      },
      fetcher
    );
    await logout('http://127.0.0.1:49152', {
      capabilityToken: 'local-capability-token',
      fetcher,
    });

    expect(fetcher).toHaveBeenLastCalledWith(
      'http://127.0.0.1:49152/auth/logout',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-1',
          [SIDECAR_CAPABILITY_HEADER]: 'local-capability-token',
        }),
      })
    );
  });

  it('throws a typed API error when login is rejected', async () => {
    await expect(
      login(
        'http://127.0.0.1:49152',
        {
          schoolCode: 'NDS-DEMO',
          username: 'directeur',
          password: 'wrong-password',
        },
        createRejectedFetch()
      )
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: "L'identifiant ou le mot de passe est incorrect.",
      status: 401,
    } satisfies Partial<AuthApiError>);
  });

  it('throws a local service error when the browser cannot reach the API', async () => {
    await expect(
      login(
        'http://127.0.0.1:49152',
        {
          schoolCode: 'NDS-DEMO',
          username: 'directeur',
          password: 'correct-password',
        },
        vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
      )
    ).rejects.toMatchObject({
      code: 'LOCAL_SERVICE_UNAVAILABLE',
      status: 0,
    } satisfies Partial<AuthApiError>);
  });

  it('sends the sidecar capability header when Tauri provides one', async () => {
    const fetcher = vi.fn(createSuccessfulFetch());

    await login(
      'http://127.0.0.1:49152',
      {
        schoolCode: 'NDS-DEMO',
        username: 'directeur',
        password: 'correct-password',
      },
      {
        capabilityToken: 'local-capability-token',
        fetcher,
      }
    );

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:49152/auth/login',
      expect.objectContaining({
        headers: expect.objectContaining({
          [SIDECAR_CAPABILITY_HEADER]: 'local-capability-token',
        }),
      })
    );
  });
});

function createSuccessfulFetch(): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(sessionResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
}

function createRejectedFetch(): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: "L'identifiant ou le mot de passe est incorrect.",
          },
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
}
