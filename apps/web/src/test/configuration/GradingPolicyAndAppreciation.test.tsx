import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AppreciationScaleView,
  GradingPoliciesResponse,
  GradingPolicyDetailResponse,
} from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import {
  AppreciationSection,
  type AppreciationClient,
} from '../../modules/configuration/AppreciationSection';
import {
  GradingPolicySection,
  type GradingPolicyClient,
} from '../../modules/configuration/GradingPolicySection';
import {
  formatHundredths,
  parseDecimalToHundredths,
} from '../../modules/configuration/gradingFormat';

const policyId = '00000000-0000-4000-8000-00000000d001';
const scaleId = '00000000-0000-4000-8000-00000000d101';

function policyDetail(
  overrides: Partial<GradingPolicyDetailResponse['policy']> = {}
): GradingPolicyDetailResponse {
  return {
    policy: {
      id: policyId,
      logicalPolicyId: 'logical-1',
      version: 1,
      name: 'Devoirs + Composition',
      status: 'DRAFT',
      scaleMax: 20,
      passThreshold: 1000,
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      effectiveAcademicYearId: null,
      publishedAt: null,
      createdAt: '2026-08-15T10:00:00.000Z',
      assessmentTypes: [
        {
          id: 'type-dev',
          name: 'Devoir',
          shortName: 'Dev.',
          scaleMax: 20,
          occurrenceMode: 'REPEATABLE',
          minOccurrences: 2,
          maxOccurrences: 6,
          required: true,
          teacherCanCreateInstances: true,
          displayOrder: 1,
        },
        {
          id: 'type-comp',
          name: 'Composition',
          shortName: 'Comp.',
          scaleMax: 20,
          occurrenceMode: 'SINGLE',
          minOccurrences: 1,
          maxOccurrences: 1,
          required: true,
          teacherCanCreateInstances: false,
          displayOrder: 2,
        },
      ],
      derivedResults: [
        {
          id: 'derived-dev',
          name: 'Moyenne des devoirs',
          shortName: 'Moy. Dev.',
          operation: 'MEAN',
          sourceDefinitionIds: ['type-dev'],
          precision: 2,
          roundingMode: 'HALF_UP',
          displayOrder: 1,
        },
      ],
      subjectResult: {
        name: 'Moyenne matière',
        shortName: 'Moy. Mat.',
        precision: 2,
        roundingMode: 'HALF_UP',
        inputs: [
          { sourceDefinitionId: 'derived-dev', weight: 5000, displayOrder: 1 },
          { sourceDefinitionId: 'type-comp', weight: 5000, displayOrder: 2 },
        ],
      },
      ...overrides,
    },
    scopes: [],
  };
}

function policiesFixture(): GradingPoliciesResponse {
  return {
    policies: [
      {
        id: policyId,
        logicalPolicyId: 'logical-1',
        version: 1,
        name: 'Devoirs + Composition',
        status: 'DRAFT',
        scaleMax: 20,
        passThreshold: 1000,
        decimalPrecision: 2,
        roundingMode: 'HALF_UP',
        effectiveAcademicYearId: null,
        publishedAt: null,
        createdAt: '2026-08-15T10:00:00.000Z',
      },
    ],
    scopes: [],
  };
}

function appreciationScale(overrides: Partial<AppreciationScaleView> = {}): AppreciationScaleView {
  return {
    id: scaleId,
    logicalScaleId: 'scale-1',
    version: 1,
    name: 'Barème secondaire',
    status: 'DRAFT',
    scaleMax: 20,
    bands: [
      {
        id: 'band-1',
        lowerBound: 1600,
        upperBound: 2000,
        labelFr: 'Très bien',
        labelAr: 'جيد جداً',
        labelEn: 'Very good',
        shortLabel: 'TB',
        displayOrder: 1,
      },
      {
        id: 'band-2',
        lowerBound: 1000,
        upperBound: 1599,
        labelFr: 'Passable',
        labelAr: 'مقبول',
        labelEn: 'Passable',
        shortLabel: 'P',
        displayOrder: 2,
      },
      {
        id: 'band-3',
        lowerBound: 0,
        upperBound: 999,
        labelFr: 'Insuffisant',
        labelAr: 'غير كاف',
        labelEn: 'Insufficient',
        shortLabel: 'I',
        displayOrder: 3,
      },
    ],
    publishedAt: null,
    createdAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('grading-policy builder (roadmap §9.8)', () => {
  function withGet(client: Omit<GradingPolicyClient, 'get'>): GradingPolicyClient {
    return { ...client, get: vi.fn().mockResolvedValue(policyDetail()) };
  }

  it('lists policies, opens the editor and shows the published status', async () => {
    const user = userEvent.setup();
    const client = withGet({ list: vi.fn().mockResolvedValue(policiesFixture()) });

    render(<GradingPolicySection apiBaseUrl={null} client={client} />);
    await screen.findByText('Devoirs + Composition');

    await user.click(screen.getByRole('button', { name: /Devoirs \+ Composition/ }));
    await screen.findByText('Types de notes');
    expect(screen.getByDisplayValue('Devoir')).toBeInTheDocument();
    expect(screen.getByText('Total des pondérations : 100 %')).toBeInTheDocument();
  });

  it('saves and publishes through the real API when no client seam is provided', async () => {
    // Regression: the editor used to require the test-seam `client` for
    // save/publish/duplicate/scopes - in the real app those buttons silently
    // did nothing. Now they fall back to the configuration API.
    const user = userEvent.setup();
    const calls: { method: string; url: string }[] = [];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';
      calls.push({ method, url });

      let data: unknown = null;
      if (url.endsWith('/grading-policies')) {
        data = policiesFixture();
      } else if (url.includes('/grading-policies/') && !url.includes('/publish')) {
        data = policyDetail();
      } else if (url.includes('/publish')) {
        data = policyDetail({ status: 'PUBLISHED' });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(<GradingPolicySection apiBaseUrl="http://127.0.0.1:49152" />);
      await screen.findByText('Devoirs + Composition');
      await user.click(screen.getByRole('button', { name: /Devoirs \+ Composition/ }));
      await screen.findByText('Enregistrer le brouillon');

      await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
      await screen.findByText(/Modifications enregistrées/);
      expect(calls.some((call) => call.method === 'PUT')).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Publier' }));
      await screen.findByText(/Modifications enregistrées/);
      expect(calls.some((call) => call.method === 'POST' && call.url.includes('/publish'))).toBe(
        true
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('runs the sandbox with the same deterministic engine and shows pass/fail', async () => {
    const user = userEvent.setup();
    const client = withGet({ list: vi.fn().mockResolvedValue(policiesFixture()) });

    render(<GradingPolicySection apiBaseUrl={null} client={client} />);
    await screen.findByText('Devoirs + Composition');
    await user.click(screen.getByRole('button', { name: /Devoirs \+ Composition/ }));
    await screen.findByText('Tester cette politique');

    // One sandbox input per assessment type (Devoir, Composition).
    const inputs = screen.getAllByPlaceholderText('Ex. 12,50');
    const devoirInput = inputs[0];
    const compositionInput = inputs[1];
    if (!devoirInput || !compositionInput) {
      throw new Error('Expected two sandbox inputs.');
    }
    await user.clear(devoirInput);
    await user.type(devoirInput, '12');
    await user.clear(compositionInput);
    await user.type(compositionInput, '14');

    // Derived mean = 12.00; subject = (12 + 14)/2 = 13.00 => PASS.
    await screen.findByText(formatHundredths(1300));
    expect(screen.getByText('Réussi')).toBeInTheDocument();
  });

  it('disables publish while the policy has validation issues', async () => {
    const user = userEvent.setup();
    const publish = vi.fn();
    const client = withGet({ list: vi.fn().mockResolvedValue(policiesFixture()), publish });

    render(<GradingPolicySection apiBaseUrl={null} client={client} />);
    await screen.findByText('Devoirs + Composition');
    await user.click(screen.getByRole('button', { name: /Devoirs \+ Composition/ }));
    await screen.findByText('Total des pondérations : 100 %');

    // Break the weights: 50% + 0% = 50%.
    const weightInputs = screen.getAllByLabelText('Pondération (%)');
    const compositionWeight = weightInputs[1];
    if (!compositionWeight) {
      throw new Error('Expected a composition weight input.');
    }
    await user.clear(compositionWeight);
    await user.type(compositionWeight, '0');

    await screen.findByText(/Total des pondérations : 50 %/);
    const publishButton = screen.getByRole('button', { name: 'Publier' });
    expect(publishButton).toBeDisabled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('creates a policy from a template through the modal', async () => {
    const user = userEvent.setup();
    const created = policyDetail();
    const create = vi.fn().mockResolvedValue(created);
    const client = withGet({ list: vi.fn().mockResolvedValue(policiesFixture()), create });

    render(<GradingPolicySection apiBaseUrl={null} client={client} />);
    await screen.findByText('Devoirs + Composition');
    await user.click(screen.getByRole('button', { name: 'Nouvelle politique' }));
    await screen.findByText('Note finale uniquement');

    await user.click(screen.getByRole('button', { name: /Note finale uniquement/ }));
    await user.click(screen.getByRole('button', { name: 'Créer' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    const firstCall = create.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected a create call.');
    }
    const config = firstCall[0] as { name: string; scaleMax: number };
    expect(config.name).toBe('Note finale');
    expect(config.scaleMax).toBe(20);
  });

  it('creates a wired graph from the Devoirs + Composition template', async () => {
    const user = userEvent.setup();
    const created = policyDetail();
    const create = vi.fn().mockResolvedValue(created);
    const client = withGet({ list: vi.fn().mockResolvedValue(policiesFixture()), create });

    render(<GradingPolicySection apiBaseUrl={null} client={client} />);
    await screen.findByText('Devoirs + Composition');
    await user.click(screen.getByRole('button', { name: 'Nouvelle politique' }));
    await screen.findByText('Note finale uniquement');

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Devoirs \+ Composition/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Créer' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    const firstCall = create.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected a create call.');
    }
    const config = firstCall[0] as {
      assessmentTypes: { id: string }[];
      derivedResults: { id: string; sourceDefinitionIds: string[] }[];
      subjectResult: { inputs: { sourceDefinitionId: string; weight: number }[] };
    };

    // Every node got a fresh UUID and all references point to real nodes:
    // the derived mean references the Devoir type, and the subject result
    // references the derived mean + the Composition type with 50/50 weights.
    const typeIds = config.assessmentTypes.map((type) => type.id);
    const derivedIds = config.derivedResults.map((derived) => derived.id);
    const allIds = [...typeIds, ...derivedIds];
    expect(typeIds).toHaveLength(2);
    expect(derivedIds).toHaveLength(1);
    const firstDerivedId = derivedIds[0];
    const firstTypeId = typeIds[0];
    const secondTypeId = typeIds[1];
    const firstDerived = config.derivedResults[0];
    if (!firstDerivedId || !firstTypeId || !secondTypeId || !firstDerived) {
      throw new Error('Expected a fully wired template graph.');
    }
    expect(firstDerivedId).not.toBe(firstTypeId);
    expect(firstDerivedId).not.toBe(secondTypeId);

    expect(firstDerived.sourceDefinitionIds).toEqual([firstTypeId]);
    expect(config.subjectResult.inputs.map((input) => input.sourceDefinitionId).sort()).toEqual(
      [firstDerivedId, secondTypeId].sort()
    );
    expect(config.subjectResult.inputs.map((input) => input.weight).sort()).toEqual([5000, 5000]);
    expect(allIds.every((id) => !id.startsWith('tpl-'))).toBe(true);
  });
});

describe('appreciation editor (roadmap §9.10)', () => {
  it('lists scales and warns about gaps when editing bands', async () => {
    const user = userEvent.setup();
    const client: AppreciationClient = {
      list: vi.fn().mockResolvedValue({ scales: [appreciationScale()] }),
    };

    render(<AppreciationSection apiBaseUrl={null} client={client} />);
    await screen.findByText('Barème secondaire');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Tranches (de la plus haute à la plus basse)');

    // No warnings for the valid fixture.
    expect(screen.queryByText(/se chevauchent/i)).not.toBeInTheDocument();

    // Create a gap: 18.00-20.00, 10.00-15.99, 0-9.99.
    const fromInputs = screen.getAllByLabelText('À partir de');
    const firstFrom = fromInputs[0];
    if (!firstFrom) {
      throw new Error('Expected a lower-bound input.');
    }
    await user.clear(firstFrom);
    await user.type(firstFrom, '18');
    await user.keyboard('{Enter}');
    const toInputs = screen.getAllByLabelText(/Jusqu.à/);
    const secondTo = toInputs[1];
    if (!secondTo) {
      throw new Error('Expected an upper-bound input.');
    }
    await user.clear(secondTo);
    await user.type(secondTo, '15,99');
    await user.keyboard('{Enter}');

    await screen.findByText(/Il manque une tranche/i);
  });

  it('shows the live appreciation preview from the average', async () => {
    const user = userEvent.setup();
    const client: AppreciationClient = {
      list: vi.fn().mockResolvedValue({ scales: [appreciationScale()] }),
    };

    render(<AppreciationSection apiBaseUrl={null} client={client} />);
    await screen.findByText('Barème secondaire');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Tranches (de la plus haute à la plus basse)');

    const average = screen.getByLabelText('Moyenne à tester');
    await user.clear(average);
    await user.type(average, '16,50');
    await screen.findByText('Très bien');
  });

  it('publishes a valid scale through the client seam', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockResolvedValue(appreciationScale({ status: 'PUBLISHED' }));
    const client: AppreciationClient = {
      list: vi.fn().mockResolvedValue({ scales: [appreciationScale()] }),
      publish,
    };

    render(<AppreciationSection apiBaseUrl={null} client={client} />);
    await screen.findByText('Barème secondaire');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));

    const publishButton = screen.getByRole('button', { name: 'Publier' });
    expect(publishButton).toBeEnabled();
    await user.click(publishButton);
    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith(scaleId);
    });
  });
});

describe('grading format helpers', () => {
  it('normalizes comma decimals to hundredths and back', () => {
    expect(parseDecimalToHundredths('12,5')).toBe(1250);
    expect(parseDecimalToHundredths('14.37')).toBe(1437);
    expect(formatHundredths(1437)).toBe('14,37');
  });

  it('rejects malformed input instead of committing a prefix match', () => {
    expect(parseDecimalToHundredths('12abc')).toBeNull();
    expect(parseDecimalToHundredths('1,234,56')).toBeNull();
    expect(parseDecimalToHundredths('')).toBeNull();
    expect(parseDecimalToHundredths('-1')).toBeNull();
    expect(parseDecimalToHundredths('12.5')).toBe(1250);
  });
});
