import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicAuthUser, RecentAuditEvent, SetupStateResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import type { DashboardCounts } from '../../modules/dashboard/dashboardApi';
import { DashboardModule } from '../../modules/dashboard/DashboardModule';
import type { DashboardClient } from '../../modules/dashboard/useDashboardState';

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

const recentActivity: RecentAuditEvent[] = [
  {
    id: '00000000-0000-4000-8000-000000000801',
    action: 'STUDENT_CREATE',
    targetType: 'student',
    targetId: '00000000-0000-4000-8000-000000000802',
    occurredAt: '2026-08-15T09:30:00.000Z',
    actorUsername: 'directeur.demo',
  },
];

function createDashboardClient(overrides: Partial<DashboardClient> = {}): DashboardClient {
  return {
    fetchCounts: () => Promise.resolve(counts),
    fetchClassDistribution: () =>
      Promise.resolve([
        { levelCode: '6E', levelName: 'Sixième', classes: 2, students: 64 },
        { levelCode: '3E', levelName: 'Troisième', classes: 1, students: 38 },
      ]),
    fetchRecentActivity: () => Promise.resolve(recentActivity),
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

  it('shows the real class distribution and audit activity, without simulation badges', async () => {
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

    // Real per-level effectifs from the enrollment relationship.
    expect(await screen.findByText('Sixième')).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.getByText('Troisième')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    // 2 + 1 = 3 real classes across levels.
    expect(screen.getByText('3 classes')).toBeInTheDocument();

    // Real audit event with its translated action and actor.
    expect(screen.getByText(/Élève créé/)).toBeInTheDocument();
    expect(screen.getByText(/directeur\.demo/)).toBeInTheDocument();

    // No simulated-data badge anywhere.
    expect(screen.queryByText('Simulation')).not.toBeInTheDocument();

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
