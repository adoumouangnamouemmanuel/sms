import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import type { ConfigurationReadinessResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import {
  ConfigurationModule,
  type ConfigurationClient,
} from '../../modules/configuration/ConfigurationModule';

const readinessFixture: ConfigurationReadinessResponse = {
  areas: [
    { area: 'SCHOOL_PROFILE', status: 'READY', label: 'Configuration générale' },
    { area: 'ACADEMIC_STRUCTURE', status: 'READY', label: 'Structure académique' },
    { area: 'GRADING_POLICY', status: 'NOT_READY', label: 'Notation' },
    { area: 'APPRECIATION', status: 'NOT_READY', label: 'Appréciations' },
    { area: 'BULLETIN', status: 'NOT_READY', label: 'Bulletin' },
  ],
  capabilities: [
    {
      capability: 'CLASSROOM_MANAGEMENT',
      status: 'READY',
      label: 'Gérer les classes',
      missing: [],
      blockedBy: [],
    },
    {
      capability: 'CURRICULUM_CONFIGURATION',
      status: 'READY',
      label: 'Configurer le curriculum',
      missing: [],
      blockedBy: [],
    },
    {
      capability: 'GRADE_ENTRY',
      status: 'NOT_READY',
      label: 'Saisir les notes',
      missing: ['GRADING_POLICY_PUBLISHED'],
      blockedBy: [],
    },
    {
      capability: 'GRADE_SUBMISSION',
      status: 'NOT_READY',
      label: 'Soumettre les notes',
      missing: ['GRADING_POLICY_PUBLISHED'],
      blockedBy: ['GRADE_ENTRY'],
    },
    {
      capability: 'GRADE_VALIDATION',
      status: 'NOT_READY',
      label: 'Valider les notes',
      missing: [],
      blockedBy: ['GRADE_SUBMISSION'],
    },
    {
      capability: 'TRANSCRIPT_CALCULATION',
      status: 'NOT_READY',
      label: 'Calculer les bulletins',
      missing: ['APPRECIATION_CONFIGURED'],
      blockedBy: ['GRADE_VALIDATION'],
    },
    {
      capability: 'PDF_GENERATION',
      status: 'NOT_READY',
      label: 'Générer les PDF',
      missing: ['BULLETIN_CONFIGURED'],
      blockedBy: ['TRANSCRIPT_CALCULATION'],
    },
  ],
};

const years = {
  years: [
    {
      id: '00000000-0000-4000-8000-000000000901',
      schoolId: '00000000-0000-4000-8000-000000000101',
      label: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      status: 'ACTIVE' as const,
      isCurrent: true,
      terms: [],
    },
  ],
};

function FlakyShell({ client }: { client: ConfigurationClient }) {
  const [, setTick] = useState(0);

  // Re-render like the real MainAppShell does when its own state changes
  // (setup state sync, menu toggles, desktop status), passing a fresh
  // onSessionExpired identity every time - exactly like handleSessionExpired.
  useEffect(() => {
    const handle = window.setInterval(() => {
      setTick((tick) => tick + 1);
    }, 60);

    return () => {
      window.clearInterval(handle);
    };
  }, []);

  return (
    <ConfigurationModule apiBaseUrl={null} client={client} onSessionExpired={() => undefined} />
  );
}

/**
 * Regression test: the shell recreates onSessionExpired on every render.
 * The Configuration module and its academic-years section must NOT refetch
 * on each parent re-render (that flickered the whole page - reported bug).
 * Callback props are held in refs so effects depend on data, not identities.
 */
describe('Configuration refetch loop regression', () => {
  it('keeps the number of listAcademicYears calls bounded when the shell re-renders', async () => {
    const listAcademicYears = vi.fn().mockResolvedValue(years);
    const client: ConfigurationClient = {
      loadReadiness: vi.fn().mockResolvedValue(readinessFixture),
      listAcademicYears,
    };

    render(<FlakyShell client={client} />);

    expect(await screen.findByText('2026-2027')).toBeInTheDocument();

    // Let the shell re-render ~10 times; a healthy section must not refetch
    // on every parent re-render (that is the reported blink).
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(listAcademicYears.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
