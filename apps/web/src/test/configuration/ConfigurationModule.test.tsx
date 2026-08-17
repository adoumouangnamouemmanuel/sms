import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AcademicYearWithTerms,
  AcademicYearsResponse,
  ConfigurationReadinessResponse,
  SetupStateResponse,
} from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import {
  ConfigurationModule,
  type ConfigurationClient,
} from '../../modules/configuration/ConfigurationModule';

const setupStateFixture: SetupStateResponse = {
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
  academicYear: null,
  termSystem: 'TRIMESTER',
  terms: [],
  classLevels: [],
  enabledModules: [],
  nextStep: 'profile',
};

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

function createClient(
  state: ConfigurationReadinessResponse = readinessFixture,
  years: AcademicYearsResponse = yearsFixture
): ConfigurationClient {
  return {
    loadReadiness: vi.fn().mockResolvedValue(state),
    listAcademicYears: vi.fn().mockResolvedValue(years),
  };
}

function renderModule(
  client: ConfigurationClient,
  props: Partial<Parameters<typeof ConfigurationModule>[0]> = {}
) {
  return render(
    <ConfigurationModule
      apiBaseUrl={null}
      client={client}
      setupState={setupStateFixture}
      {...props}
    />
  );
}

const yearsFixture: AcademicYearsResponse = {
  years: [
    {
      id: '00000000-0000-4000-8000-000000000901',
      schoolId: '00000000-0000-4000-8000-000000000101',
      label: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      status: 'ACTIVE',
      isCurrent: true,
      terms: [
        {
          id: '00000000-0000-4000-8000-000000000911',
          label: 'Trimestre 1',
          termNumber: 1,
          startDate: '2026-09-01',
          endDate: '2026-12-19',
          isCurrent: true,
        },
        {
          id: '00000000-0000-4000-8000-000000000912',
          label: 'Trimestre 2',
          termNumber: 2,
          startDate: '2027-01-04',
          endDate: '2027-03-24',
          isCurrent: false,
        },
      ],
    },
  ],
};

describe('ConfigurationModule', () => {
  it('renders French area cards with their statuses', async () => {
    renderModule(createClient());

    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();

    expect(screen.getByText('2 / 5 sections prêtes')).toBeInTheDocument();
    expect(screen.getByText('Configuration générale')).toBeInTheDocument();
    // The area card and the quick link both carry this label.
    expect(screen.getAllByText('Structure académique').length).toBeGreaterThanOrEqual(2);
    // The tab and the area card both carry this label.
    expect(screen.getAllByText('Notation').length).toBeGreaterThanOrEqual(2);
    // READY pills appear on the two ready areas and the two ready capabilities.
    expect(screen.getAllByText('Prête').length).toBe(4);
    expect(screen.getAllByText('À configurer').length).toBeGreaterThan(0);
  });

  it('lists every capability with the missing requirement in French', async () => {
    renderModule(createClient());

    expect(await screen.findByText('Saisir les notes')).toBeInTheDocument();
    // GRADE_ENTRY and GRADE_SUBMISSION both list the same missing requirement.
    expect(screen.getAllByText('Publiez une politique de notation.').length).toBe(2);
    expect(screen.getByText('Configurez les appréciations.')).toBeInTheDocument();
    expect(screen.getByText('Configurez le bulletin.')).toBeInTheDocument();

    // Blocked capabilities explain their dependency.
    expect(screen.getByText('Dépend de : Valider les notes')).toBeInTheDocument();
  });

  it('shows the French retry message when the readiness load fails', async () => {
    const failingClient: ConfigurationClient = {
      loadReadiness: vi.fn().mockRejectedValue(new Error('sidecar down')),
    };

    renderModule(failingClient);

    expect(
      await screen.findByText('La configuration est temporairement indisponible. Réessayez.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('navigates to the profile and structure screens through the quick links', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderModule(createClient(), { onNavigate });

    expect(await screen.findByText("Profil de l'école")).toBeInTheDocument();

    // The quick links live in the "Accès rapide" section; the tab bar also
    // carries the same labels, so scope the click to the section.
    const quickLinks = screen.getByRole('region', { name: 'Accès rapide' });
    await user.click(within(quickLinks).getByRole('button', { name: "Profil de l'école" }));
    expect(onNavigate).toHaveBeenCalledWith('SCHOOL_SETUP');

    await user.click(within(quickLinks).getByRole('button', { name: 'Structure académique' }));
    expect(onNavigate).toHaveBeenCalledWith('CLASSES');
  });

  it('keeps accessibility semantics for the status summary', async () => {
    renderModule(createClient());

    const readinessPill = await screen.findByText('2 / 5 sections prêtes');
    expect(readinessPill.closest('span')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sections de configuration' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: "Capacités de l'établissement" })
    ).toBeInTheDocument();
  });
});

describe('ConfigurationModule academic years (roadmap §9.3)', () => {
  function tabsNav() {
    return screen.getByRole('navigation', { name: 'Configuration tabs' });
  }

  async function openYearsTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(tabsNav()).getByRole('button', { name: 'Années académiques' }));
  }

  it('lists the active year with its terms and the current badge', async () => {
    const user = userEvent.setup();
    renderModule(createClient());
    await openYearsTab(user);

    expect(await screen.findByText('2026-2027')).toBeInTheDocument();
    expect(screen.getByText(/Trimestre 1/)).toBeInTheDocument();
    expect(screen.getByText('Trimestre 2')).toBeInTheDocument();
    expect(screen.getByText('Année en cours')).toBeInTheDocument();
    // The active year offers a close action, not an activate action.
    expect(screen.getByRole('button', { name: 'Clôturer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activer' })).not.toBeInTheDocument();
  });

  it('activates a draft year through the client seam', async () => {
    const user = userEvent.setup();
    const draftYear: AcademicYearWithTerms = {
      id: '00000000-0000-4000-8000-000000000902',
      schoolId: '00000000-0000-4000-8000-000000000101',
      label: '2027-2028',
      startDate: '2027-09-01',
      endDate: '2028-06-30',
      status: 'DRAFT',
      isCurrent: false,
      terms: [
        {
          id: '00000000-0000-4000-8000-000000000921',
          label: 'Trimestre 1',
          termNumber: 1,
          startDate: '2027-09-01',
          endDate: '2027-12-19',
          isCurrent: false,
        },
      ],
    };
    const changeStatus = vi.fn().mockResolvedValue({ ...draftYear, status: 'ACTIVE' });
    const client: ConfigurationClient = {
      loadReadiness: vi.fn().mockResolvedValue(readinessFixture),
      listAcademicYears: vi.fn().mockResolvedValue({ years: [draftYear] }),
      changeAcademicYearStatus: changeStatus,
    };

    renderModule(client);
    await openYearsTab(user);

    expect(await screen.findByText('2027-2028')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Activer' }));

    await waitFor(() => {
      expect(changeStatus).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000902', {
        status: 'ACTIVE',
      });
    });
  });

  it('shows the school profile and saves edits through the client seam', async () => {
    const user = userEvent.setup();
    const saveProfile = vi.fn().mockResolvedValue({
      ...setupStateFixture,
      school: { ...setupStateFixture.school, motto: 'Réussite et discipline' },
    });
    const client = createClient();
    client.saveProfile = saveProfile;

    renderModule(client);
    await user.click(within(tabsNav()).getByRole('button', { name: "Profil de l'école" }));

    expect(await screen.findByRole('heading', { name: "Profil de l'école" })).toBeInTheDocument();
    expect(screen.getAllByText('Ecole Demo').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalled();
    });
  });

  it('opens the create-year modal and blocks submission until all dates are set', async () => {
    const user = userEvent.setup();
    const createAcademicYear = vi.fn().mockResolvedValue(yearsFixture.years[0]);
    const client: ConfigurationClient = {
      loadReadiness: vi.fn().mockResolvedValue(readinessFixture),
      listAcademicYears: vi.fn().mockResolvedValue({ years: [] }),
      createAcademicYear,
    };

    renderModule(client);
    await openYearsTab(user);

    expect(await screen.findByText('Aucune année scolaire pour le moment.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nouvelle année' }));
    expect(screen.getByRole('heading', { name: 'Nouvelle année scolaire' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ex. 2026-2027'), '2027-2028');
    await user.click(screen.getByRole('button', { name: 'Créer' }));

    // Missing dates: the request must not fire and a French message guides the user.
    await screen.findByText('Renseignez tous les champs requis.');
    expect(createAcademicYear).not.toHaveBeenCalled();
  });
});
