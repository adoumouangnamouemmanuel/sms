import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicAuthUser, SetupStateResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsModule, type SettingsClient } from '../modules/settings/SettingsModule';

const user: PublicAuthUser = {
  id: '00000000-0000-4000-8000-000000000901',
  schoolId: '00000000-0000-4000-8000-000000000101',
  username: 'directeur.demo',
  role: 'SCHOOL_MASTER',
};

function createSetupState(): SetupStateResponse {
  return {
    school: {
      id: '00000000-0000-4000-8000-000000000101',
      code: 'NDS-DEMO',
      name: 'Ecole Demo',
      shortName: 'Demo',
      logoUrl: null,
      address: 'Rue 12, Quartier Farcha',
      city: 'N Djamena',
      country: 'TD',
      phone: '+23566000000',
      email: 'contact@demo.td',
      motto: 'Travail et réussite',
      ministryCode: null,
      locale: 'fr',
      timezone: 'Africa/Ndjamena',
      currency: 'XAF',
      setupStatus: 'COMPLETED',
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
    enabledModules: [
      {
        id: '00000000-0000-4000-8000-000000000701',
        schoolId: '00000000-0000-4000-8000-000000000101',
        moduleName: 'SCHOOL_SETUP',
        isEnabled: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000702',
        schoolId: '00000000-0000-4000-8000-000000000101',
        moduleName: 'ACADEMIC_STRUCTURE',
        isEnabled: true,
      },
    ],
    nextStep: 'profile',
  };
}

function createSettingsClient(overrides: Partial<SettingsClient> = {}): SettingsClient {
  return {
    saveProfile: () => Promise.resolve(createSetupState()),
    ...overrides,
  };
}

describe('SettingsModule', () => {
  it('renders the real school profile and enabled modules', () => {
    render(
      <SettingsModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createSettingsClient()}
        setupState={createSetupState()}
        user={user}
      />
    );

    expect(screen.getAllByText('Configuration').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ecole Demo')).toBeInTheDocument();
    expect(screen.getByText('N Djamena')).toBeInTheDocument();
    expect(screen.getByText('2026-2027')).toBeInTheDocument();
    expect(screen.getByText('Structure académique')).toBeInTheDocument();
    expect(screen.getByText('Trimestres')).toBeInTheDocument();
  });

  it('edits the profile and reports success through the change callback', async () => {
    const userSession = userEvent.setup();
    const saveProfile = vi.fn().mockResolvedValue(createSetupState());
    const onSetupStateChange = vi.fn();

    render(
      <SettingsModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createSettingsClient({ saveProfile })}
        onSetupStateChange={onSetupStateChange}
        setupState={createSetupState()}
        user={user}
      />
    );

    await userSession.click(screen.getByRole('button', { name: 'Modifier' }));
    const nameInput = screen.getByLabelText("Nom de l'école");
    await userSession.clear(nameInput);
    await userSession.type(nameInput, 'Ecole Demo 2');
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ecole Demo 2' }));
    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
    expect(onSetupStateChange).toHaveBeenCalledTimes(1);
  });
});
