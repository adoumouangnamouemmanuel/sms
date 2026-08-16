import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SetupStateResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { AuthenticatedSetupApp } from '../../modules/setup/AuthenticatedSetupApp';
import type { SetupClient } from '../../modules/setup/useSetupState';

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

  it('guides through the module steps and advances the setup status', async () => {
    const userSession = userEvent.setup();
    const pendingState = createSetupState({ setupStatus: 'PENDING', nextStep: 'profile' });
    const profileState = createSetupState({
      setupStatus: 'PROFILE_COMPLETED',
      nextStep: 'calendar',
    });
    const calendarState = createSetupState({
      setupStatus: 'CALENDAR_COMPLETED',
      nextStep: 'classLevels',
    });
    const classLevelsState = createSetupState({
      setupStatus: 'CLASS_LEVELS_COMPLETED',
      nextStep: 'subjects',
    });
    const subjectsState = createSetupState({
      setupStatus: 'SUBJECTS_COMPLETED',
      nextStep: 'groups',
    });

    const advanceStep = vi.fn().mockResolvedValue(subjectsState);
    const setupClient = createSetupClient({
      advanceStep,
      getState: vi.fn().mockResolvedValue(pendingState),
      saveCalendar: vi.fn().mockResolvedValue(calendarState),
      saveClassLevels: vi.fn().mockResolvedValue(classLevelsState),
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

    // Walk the wizard to the subjects step (profile -> calendar -> levels).
    expect(await screen.findByRole('heading', { name: 'Profil de l’école' })).toBeInTheDocument();
    await userSession.click(screen.getByRole('button', { name: 'Continuer' }));
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer et continuer' }));

    await userSession.click(
      await screen.findByRole('button', { name: 'Enregistrer et continuer' })
    );
    await userSession.click(
      await screen.findByRole('button', { name: 'Enregistrer et continuer' })
    );

    expect(
      await screen.findByRole('heading', { name: 'Matières et coefficients' })
    ).toBeInTheDocument();

    // Advancing calls the setup advance endpoint and moves to the next step.
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer et continuer' }));
    expect(advanceStep).toHaveBeenCalledWith({ step: 'subjects' }, expect.any(Object));
    expect(await screen.findByRole('heading', { name: 'Groupes de matières' })).toBeInTheDocument();
  });

  it('shows French validation errors for empty required fields', async () => {
    const userSession = userEvent.setup();
    const pendingState = createSetupState({ setupStatus: 'PENDING', nextStep: 'profile' });
    const setupClient = createSetupClient({
      getState: vi.fn().mockResolvedValue(pendingState),
      saveProfile: vi.fn(),
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
    const nameInput = await screen.findByRole('textbox', { name: /Nom de l'école/i });
    const cityInput = await screen.findByRole('textbox', { name: /Ville/i });

    await userSession.clear(nameInput);
    await userSession.clear(cityInput);

    await userSession.click(screen.getByRole('button', { name: 'Continuer' }));

    // Form shouldn't advance and should show French validation messages
    expect(await screen.findAllByText(/Vérifiez les champs du formulaire/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enregistrer et continuer' })
    ).not.toBeInTheDocument();
    expect(setupClient.saveProfile).not.toHaveBeenCalled();
  });

  it('shows a French error on service failure and recovers on retry', async () => {
    const userSession = userEvent.setup();
    const pendingState = createSetupState({ setupStatus: 'PENDING', nextStep: 'profile' });
    const profileState = createSetupState({
      setupStatus: 'PROFILE_COMPLETED',
      nextStep: 'calendar',
    });

    let attempt = 0;
    const saveProfileMock = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve(profileState);
    });

    const setupClient = createSetupClient({
      getState: vi.fn().mockResolvedValue(pendingState),
      saveProfile: saveProfileMock,
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
    await userSession.click(await screen.findByRole('button', { name: 'Continuer' }));

    await userSession.click(screen.getByRole('button', { name: 'Enregistrer et continuer' }));

    expect(
      await screen.findByText('La configuration locale a échoué. Réessayez.')
    ).toBeInTheDocument();

    await userSession.click(screen.getByRole('button', { name: 'Enregistrer et continuer' }));

    expect(await screen.findByRole('heading', { name: 'Calendrier scolaire' })).toBeInTheDocument();
    expect(saveProfileMock).toHaveBeenCalledTimes(2);
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
    expect(screen.getByText(/Établissement et Structure académique/)).toBeInTheDocument();
    expect(screen.queryByText(/Élèves/)).not.toBeInTheDocument();
  });
});

function createSetupClient(overrides: Partial<SetupClient>): SetupClient {
  const fallbackState = createSetupState({});

  return {
    advanceStep: () => Promise.resolve(fallbackState),
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
