import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicAuthUser, SetupStateResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import type { DashboardCounts } from '../modules/dashboard/dashboardApi';
import { DashboardModule } from '../modules/dashboard/DashboardModule';
import type { DashboardClient } from '../modules/dashboard/useDashboardState';

const counts: DashboardCounts = {
  studentsActive: 128,
  studentsArchived: 4,
  teachersActive: 9,
  teachersArchived: 1,
  guardiansActive: 61,
  guardiansArchived: 0,
};

const user: PublicAuthUser = {
  id: '00000000-0000-4000-8000-000000000901',
  schoolId: '00000000-0000-4000-8000-000000000101',
  username: 'directeur.demo',
  role: 'SCHOOL_MASTER',
};

function createDashboardClient(overrides: Partial<DashboardClient> = {}): DashboardClient {
  return {
    fetchCounts: () => Promise.resolve(counts),
    ...overrides,
  };
}

describe('DashboardModule', () => {
  it('shows real headcounts and the greeting', async () => {
    render(
      <DashboardModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createDashboardClient()}
        onNavigate={vi.fn()}
        setupState={createSetupState()}
        user={user}
      />
    );

    expect(await screen.findByText('Bonjour, directeur')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
    // 4 + 1 + 0 archived records
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('marks simulated widgets and quick-actions navigate', async () => {
    const onNavigate = vi.fn();
    render(
      <DashboardModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createDashboardClient()}
        onNavigate={onNavigate}
        setupState={createSetupState()}
        user={user}
      />
    );

    // Real level names drive the simulated distribution.
    expect(await screen.findByText('Sixième')).toBeInTheDocument();
    // Simulated activity timeline.
    expect(screen.getByText('Import de 6 élèves confirmé')).toBeInTheDocument();
    // Every simulated section carries the badge.
    expect(screen.getAllByText('Simulation')).toHaveLength(2);

    const userSession = userEvent.setup();
    await userSession.click(screen.getByRole('button', { name: 'Voir les élèves' }));
    expect(onNavigate).toHaveBeenCalledWith('STUDENTS');
  });
});

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
