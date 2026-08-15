import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken, rememberAccessToken } from '../modules/auth';
import { saveSchoolProfile } from '../modules/setup/setupApi';
import { resolveSetupErrorMessageKey, SetupApiError } from '../modules/setup/setupErrors';

const setupStateResponse = {
  success: true,
  data: {
    school: {
      id: '00000000-0000-4000-8000-000000000101',
      code: 'NDS-DEMO',
      name: 'Lycee Demo',
      shortName: null,
      logoUrl: null,
      address: null,
      city: 'N Djamena',
      country: 'TD',
      phone: null,
      email: null,
      motto: null,
      ministryCode: null,
      locale: 'fr',
      timezone: 'Africa/Ndjamena',
      currency: 'XAF',
      setupStatus: 'PROFILE_COMPLETED',
    },
    academicYear: null,
    termSystem: null,
    terms: [],
    classLevels: [],
    enabledModules: [],
    nextStep: 'calendar',
  },
};

describe('setupApi', () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it('sends bearer and sidecar headers when saving setup data', async () => {
    rememberAccessToken('access-token-1', '2026-08-13T10:15:00.000Z');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(setupStateResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await saveSchoolProfile(
      'http://127.0.0.1:49152',
      {
        name: 'Lycee Demo',
        city: 'N Djamena',
      },
      {
        capabilityToken: 'local-capability-token',
        fetcher,
      }
    );

    const request = readLastFetchCall(fetcher);

    expect(request.url).toBe('http://127.0.0.1:49152/setup/profile');
    expect(request.options.method).toBe('PUT');
    expect(request.options.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer access-token-1',
        'x-edutrack-capability': 'local-capability-token',
      })
    );
  });

  it('returns a local service error when setup cannot reach the API', async () => {
    await expect(
      saveSchoolProfile(
        'http://127.0.0.1:49152',
        {
          name: 'Lycee Demo',
          city: 'N Djamena',
        },
        {
          fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
        }
      )
    ).rejects.toMatchObject({
      code: 'LOCAL_SERVICE_UNAVAILABLE',
      status: 0,
    } satisfies Partial<SetupApiError>);
  });

  it('maps setup validation errors to a form-specific message', () => {
    expect(
      resolveSetupErrorMessageKey(new SetupApiError('VALIDATION_ERROR', 'Invalid input.', 400))
    ).toBe('setup.errors.validation');
  });
});

function readLastFetchCall(fetcher: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [url, options] = fetcher.mock.calls.at(-1) ?? [];

  return {
    options: options ?? {},
    url,
  };
}
