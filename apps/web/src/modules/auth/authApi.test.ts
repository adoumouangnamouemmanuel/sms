import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from './authApi';
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
