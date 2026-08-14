import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SetupStateResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { AuthenticatedSetupApp } from './AuthenticatedSetupApp';
import type { SetupClient } from './useSetupState';

const user = {
  id: '00000000-0000-4000-8000-000000000201',
  schoolId: '00000000-0000-4000-8000-000000000101',
  username: 'directeur',
  role: 'SCHOOL_MASTER',
} as const;

describe('AuthenticatedSetupApp', () => {
  it('loads setup state and advances after saving the profile step', async () => {
    const userSession = userEvent.setup();
    const pendingState = createSetupState({ setupStatus: 'PENDING', nextStep: 'profile' });
    const profileState = createSetupState({
      setupStatus: 'PROFILE_COMPLETED',
      nextStep: 'calendar',
    });
    const setupClient = createSetupClient({
      getState: vi.fn().mockResolvedValue(pendingState),
      saveProfile: vi.fn().mockResolvedValue(profileState),
    });

    render(
      <AuthenticatedSetupApp
        apiBaseUrl="http://127.0.0.1:49152"
        onLoggedOut={vi.fn()}
        setupClient={setupClient}
        user={user}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Profil de l’école' })).toBeInTheDocument();

    await userSession.click(screen.getByRole('button', { name: 'Continuer' }));
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer et continuer' }));

    expect(setupClient.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ecole Demo',
        city: 'N Djamena',
      }),
      expect.any(Object)
    );
    expect(await screen.findByRole('heading', { name: 'Calendrier scolaire' })).toBeInTheDocument();
  });

  it('shows completed setup navigation without future modules', async () => {
    const completedState = createSetupState({
      enabledModules: ['SCHOOL_SETUP', 'ACADEMIC_STRUCTURE'],
      setupStatus: 'COMPLETED',
      nextStep: 'review',
    });
    const setupClient = createSetupClient({
      getState: vi.fn().mockResolvedValue(completedState),
    });

    render(
      <AuthenticatedSetupApp
        apiBaseUrl="http://127.0.0.1:49152"
        onLoggedOut={vi.fn()}
        setupClient={setupClient}
        user={user}
      />
    );

    expect(await screen.findByText('Le socle de l’école est prêt')).toBeInTheDocument();
    expect(screen.getByText(/Configuration et Structure académique/)).toBeInTheDocument();
    expect(screen.queryByText(/Élèves/)).not.toBeInTheDocument();
  });
});

function createSetupClient(overrides: Partial<SetupClient>): SetupClient {
  const fallbackState = createSetupState({});

  return {
    complete: () => Promise.resolve(fallbackState),
    getState: () => Promise.resolve(fallbackState),
    saveCalendar: () => Promise.resolve(fallbackState),
    saveClassLevels: () => Promise.resolve(fallbackState),
    saveProfile: () => Promise.resolve(fallbackState),
    ...overrides,
  };
}

function createSetupState(
  overrides: Partial<{
    enabledModules: ('ACADEMIC_STRUCTURE' | 'SCHOOL_SETUP')[];
    nextStep: SetupStateResponse['nextStep'];
    setupStatus: SetupStateResponse['school']['setupStatus'];
  }>
): SetupStateResponse {
  return {
    school: {
      id: '00000000-0000-4000-8000-000000000101',
      code: 'NDS-DEMO',
      name: 'Ecole Demo',
      shortName: 'Demo',
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
      setupStatus: overrides.setupStatus ?? 'PENDING',
    },
    academicYear: {
      id: '00000000-0000-4000-8000-000000000401',
      schoolId: '00000000-0000-4000-8000-000000000101',
      label: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isCurrent: true,
    },
    termSystem: 'TRIMESTER',
    terms: [
      {
        id: '00000000-0000-4000-8000-000000000501',
        schoolId: '00000000-0000-4000-8000-000000000101',
        academicYearId: '00000000-0000-4000-8000-000000000401',
        label: 'Trimestre 1',
        termNumber: 1,
        startDate: '2026-09-01',
        endDate: '2026-12-20',
        isCurrent: true,
      },
    ],
    classLevels: [
      {
        id: '00000000-0000-4000-8000-000000000601',
        schoolId: '00000000-0000-4000-8000-000000000101',
        code: '6E',
        name: 'Sixième',
        displayOrder: 1,
        isExamYear: false,
        isActive: true,
      },
    ],
    enabledModules: (overrides.enabledModules ?? []).map((moduleName, index) => ({
      id: `00000000-0000-4000-8000-00000000070${String(index + 1)}`,
      schoolId: '00000000-0000-4000-8000-000000000101',
      moduleName,
      isEnabled: true,
    })),
    nextStep: overrides.nextStep ?? 'profile',
  };
}
