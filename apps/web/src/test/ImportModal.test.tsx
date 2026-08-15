import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConfirmImportResponse, ImportPreviewResponse } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ImportModal } from '../modules/imports/ImportModal';
import { ImportsApiError } from '../modules/imports/importsErrors';
import type { ImportsClient } from '../modules/imports/useImportState';

const preview: ImportPreviewResponse = {
  importId: 'preview-1',
  kind: 'STUDENTS',
  filename: 'eleves.xlsx',
  totalRows: 3,
  validRows: 2,
  errorRows: 1,
  rows: [
    {
      rowNumber: 2,
      code: null,
      firstName: 'Aminata',
      lastName: 'Mahamat',
      values: {
        code: null,
        firstName: 'Aminata',
        lastName: 'Mahamat',
        sex: 'F',
        dateOfBirth: '2012-03-14',
        nationality: 'Tchadienne',
        phone: null,
        email: null,
        address: null,
      },
      errors: [],
    },
    {
      rowNumber: 3,
      code: null,
      firstName: 'Ibrahim',
      lastName: 'Ousmane',
      values: {
        code: null,
        firstName: 'Ibrahim',
        lastName: 'Ousmane',
        sex: 'M',
        dateOfBirth: null,
        nationality: null,
        phone: null,
        email: null,
        address: null,
      },
      errors: [],
    },
    {
      rowNumber: 4,
      code: null,
      firstName: '',
      lastName: 'Ahmat',
      values: {
        code: null,
        firstName: null,
        lastName: 'Ahmat',
        sex: null,
        dateOfBirth: null,
        nationality: null,
        phone: null,
        email: null,
        address: null,
      },
      errors: ['Prénom requis.'],
    },
  ],
};

const report: ConfirmImportResponse = {
  importIdentifier: 'rentree-2026',
  alreadyConfirmed: false,
  imported: 2,
  skippedExisting: 0,
  errorRows: 0,
};

describe('ImportModal', () => {
  it('downloads the French template from the choose step', async () => {
    const userSession = userEvent.setup();
    const downloadTemplate = vi.fn().mockResolvedValue(new Blob(['template']));
    const client = createImportsClient({ downloadTemplate });

    render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Importer des élèves')).toBeInTheDocument();
    await userSession.click(screen.getByRole('button', { name: 'Télécharger le modèle (.xlsx)' }));

    expect(downloadTemplate).toHaveBeenCalledWith('STUDENTS', expect.any(Object));
  });

  it('analyzes a file and shows the preview with row-level errors', async () => {
    const userSession = userEvent.setup();
    const previewImport = vi.fn().mockResolvedValue(preview);
    const client = createImportsClient({ previewImport });

    render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    const file = new File(['fake'], 'eleves.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await userSession.upload(screen.getByLabelText('Fichier à importer'), file);
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));

    expect(previewImport).toHaveBeenCalledWith('STUDENTS', file, expect.any(Object));
    expect(await screen.findByText('2 valides')).toBeInTheDocument();
    expect(screen.getByText('1 en erreur')).toBeInTheDocument();
    expect(screen.getByText('Prénom requis.')).toBeInTheDocument();
    expect(screen.getByText('Aminata')).toBeInTheDocument();
  });

  it('confirms the import and shows the report', async () => {
    const userSession = userEvent.setup();
    const confirmImport = vi.fn().mockResolvedValue(report);
    const client = createImportsClient({
      confirmImport,
      previewImport: vi.fn().mockResolvedValue(preview),
    });

    render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    const file = new File(['fake'], 'eleves.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await userSession.upload(screen.getByLabelText('Fichier à importer'), file);
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    await userSession.type(screen.getByPlaceholderText('Ex. rentree-2026-09-01'), 'rentree-2026');
    await userSession.click(screen.getByRole('button', { name: 'Confirmer l’import' }));

    expect(confirmImport).toHaveBeenCalledWith(
      { importId: 'preview-1', importIdentifier: 'rentree-2026' },
      expect.any(Object)
    );
    expect(await screen.findByText('Rapport d’import')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the already-confirmed notice for a repeated identifier', async () => {
    const userSession = userEvent.setup();
    const confirmImport = vi.fn().mockResolvedValue({
      importIdentifier: 'rentree-2026',
      alreadyConfirmed: true,
      imported: 0,
      skippedExisting: 2,
      errorRows: 0,
    });
    const client = createImportsClient({
      confirmImport,
      previewImport: vi.fn().mockResolvedValue(preview),
    });

    render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    const file = new File(['fake'], 'eleves.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await userSession.upload(screen.getByLabelText('Fichier à importer'), file);
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    await userSession.type(screen.getByPlaceholderText('Ex. rentree-2026-09-01'), 'rentree-2026');
    await userSession.click(screen.getByRole('button', { name: 'Confirmer l’import' }));

    expect(
      await screen.findByText(
        'Cet identifiant d’import a déjà été confirmé. Rien de nouveau n’a été importé.'
      )
    ).toBeInTheDocument();
  });

  it('blocks the confirm action and offers reconnection when the session expired', async () => {
    const userSession = userEvent.setup();
    const onClose = vi.fn();
    const onSessionExpired = vi.fn();
    const confirmImport = vi
      .fn()
      .mockRejectedValue(new ImportsApiError('INVALID_ACCESS_TOKEN', 'Session expiree.', 401));
    const client = createImportsClient({
      confirmImport,
      previewImport: vi.fn().mockResolvedValue(preview),
    });

    render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={onClose}
        onSessionExpired={onSessionExpired}
      />
    );

    const file = new File(['fake'], 'eleves.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await userSession.upload(screen.getByLabelText('Fichier à importer'), file);
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    await userSession.type(screen.getByPlaceholderText('Ex. rentree-2026-09-01'), 'rentree-2026');
    await userSession.click(screen.getByRole('button', { name: 'Confirmer l’import' }));

    expect(
      await screen.findByText('La session locale est expirée. Reconnectez-vous.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer l’import' })).toBeDisabled();

    await userSession.click(screen.getByRole('button', { name: 'Se reconnecter' }));

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('downloads the rejected-rows CSV from the preview', async () => {
    const userSession = userEvent.setup();
    const downloadErrorsCsv = vi.fn().mockResolvedValue(new Blob(['csv']));
    const client = createImportsClient({
      downloadErrorsCsv,
      previewImport: vi.fn().mockResolvedValue(preview),
    });

    render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    const file = new File(['fake'], 'eleves.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await userSession.upload(screen.getByLabelText('Fichier à importer'), file);
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('1 en erreur');

    await userSession.click(
      screen.getByRole('button', { name: 'Télécharger les lignes en erreur (.csv)' })
    );

    expect(downloadErrorsCsv).toHaveBeenCalledWith('preview-1', expect.any(Object));
  });
});

function createImportsClient(overrides: Partial<ImportsClient>): ImportsClient {
  return {
    confirmImport: () => Promise.resolve(report),
    downloadErrorsCsv: () => Promise.resolve(new Blob(['csv'])),
    downloadTemplate: () => Promise.resolve(new Blob(['template'])),
    previewImport: () => Promise.resolve(preview),
    ...overrides,
  };
}
