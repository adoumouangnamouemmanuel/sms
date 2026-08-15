import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SetupStateResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import { StructureModule, type StructureClient } from '../modules/structure/StructureModule';

function createSetupState(): SetupStateResponse {
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
    terms: [],
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
      {
        id: '00000000-0000-4000-8000-000000000602',
        schoolId: '00000000-0000-4000-8000-000000000101',
        code: '3E',
        name: 'Troisième',
        displayOrder: 2,
        isExamYear: true,
        isActive: true,
      },
    ],
    enabledModules: [
      {
        id: '00000000-0000-4000-8000-000000000701',
        schoolId: '00000000-0000-4000-8000-000000000101',
        moduleName: 'ACADEMIC_STRUCTURE',
        isEnabled: true,
      },
    ],
    nextStep: 'profile',
  };
}

function createStructureClient(overrides: Partial<StructureClient> = {}): StructureClient {
  return {
    saveClassLevels: () => Promise.resolve(createSetupState()),
    ...overrides,
  };
}

describe('StructureModule', () => {
  it('shows real levels, the exam badge, and simulated classes', () => {
    render(
      <StructureModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createStructureClient()}
        setupState={createSetupState()}
      />
    );

    expect(screen.getByText('Structure académique')).toBeInTheDocument();
    expect(screen.getByText('Sixième')).toBeInTheDocument();
    expect(screen.getByText('Troisième')).toBeInTheDocument();
    expect(screen.getByText('Examen')).toBeInTheDocument();
    // Simulated class cards derive from the real levels.
    expect(screen.getByText('Sixième A')).toBeInTheDocument();
    expect(screen.getByText('Troisième A')).toBeInTheDocument();
    // 2 levels × 2 mock classes = 4 cards.
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('adds a level and persists through the change callback', async () => {
    const userSession = userEvent.setup();
    const saveClassLevels = vi.fn().mockResolvedValue(createSetupState());
    const onSetupStateChange = vi.fn();

    render(
      <StructureModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createStructureClient({ saveClassLevels })}
        onSetupStateChange={onSetupStateChange}
        setupState={createSetupState()}
      />
    );

    await userSession.click(screen.getByRole('button', { name: 'Modifier' }));
    await userSession.click(screen.getByRole('button', { name: '+ Ajouter un niveau' }));

    const levelNameInput = screen.getByLabelText('Nom du niveau 3');
    await userSession.type(levelNameInput, 'Terminale');
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer' }));

    const firstCall = saveClassLevels.mock.calls[0]?.[0] as { classLevels: { name: string }[] };
    expect(firstCall.classLevels.map((level) => level.name)).toContain('Terminale');
    expect(await screen.findByText('Structure enregistrée.')).toBeInTheDocument();
    expect(onSetupStateChange).toHaveBeenCalledTimes(1);
  });
});
