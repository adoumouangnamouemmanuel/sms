import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Choisir un fichier…')).toBeInTheDocument();
    await userSession.click(screen.getByRole('button', { name: 'Télécharger le modèle (.xlsx)' }));

    expect(downloadTemplate).toHaveBeenCalledWith('STUDENTS', expect.any(Object));
  });

  it('accepts a file picked from the French chooser', async () => {
    const userSession = userEvent.setup();
    const previewImport = vi.fn().mockResolvedValue(preview);
    const client = createImportsClient({ previewImport });

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));

    expect(await screen.findByText('2 valides')).toBeInTheDocument();
    expect(previewImport).toHaveBeenCalledTimes(1);
  });

  it('accepts a file dragged and dropped onto the drop zone', async () => {
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

    const file = new File(['fake'], 'eleves-drag.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dropZone = screen.getByTestId('import-dropzone');
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('eleves-drag.xlsx')).toBeInTheDocument();
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));

    expect(previewImport).toHaveBeenCalledWith('STUDENTS', file, expect.any(Object));
    expect(await screen.findByText('2 valides')).toBeInTheDocument();
  });

  it('analyzes a file and shows the preview with row-level errors', async () => {
    const userSession = userEvent.setup();
    const previewImport = vi.fn().mockResolvedValue(preview);
    const client = createImportsClient({ previewImport });

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));

    expect(previewImport).toHaveBeenCalledWith('STUDENTS', expect.any(File), expect.any(Object));
    expect(await screen.findByText('2 valides')).toBeInTheDocument();
    expect(screen.getByText('1 en erreur')).toBeInTheDocument();
    expect(screen.getByText('Prénom requis.')).toBeInTheDocument();
    expect(screen.getByText('Aminata')).toBeInTheDocument();
  });

  it('prefills the import identifier from the file name and lets the user edit it', async () => {
    const userSession = userEvent.setup();
    const client = createImportsClient({ previewImport: vi.fn().mockResolvedValue(preview) });

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    const expected = `eleves-${new Date().toISOString().slice(0, 10)}`;
    expect(screen.getByPlaceholderText('Ex. rentree-2026-09-01')).toHaveValue(expected);

    await userSession.clear(screen.getByPlaceholderText('Ex. rentree-2026-09-01'));
    await userSession.type(screen.getByPlaceholderText('Ex. rentree-2026-09-01'), 'rentree-2026');
  });

  it('confirms the import and shows the report', async () => {
    const userSession = userEvent.setup();
    const confirmImport = vi.fn().mockResolvedValue(report);
    const client = createImportsClient({
      confirmImport,
      previewImport: vi.fn().mockResolvedValue(preview),
    });

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    await userSession.clear(screen.getByPlaceholderText('Ex. rentree-2026-09-01'));
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

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    await userSession.clear(screen.getByPlaceholderText('Ex. rentree-2026-09-01'));
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

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={onClose}
        onSessionExpired={onSessionExpired}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('2 valides');

    await userSession.clear(screen.getByPlaceholderText('Ex. rentree-2026-09-01'));
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

    const view = render(
      <ImportModal
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        kind="STUDENTS"
        onClose={vi.fn()}
      />
    );

    await uploadFile(userSession, view.container, 'eleves.xlsx');
    await userSession.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    await screen.findByText('1 en erreur');

    await userSession.click(
      screen.getByRole('button', { name: 'Télécharger les lignes en erreur (.csv)' })
    );

    expect(downloadErrorsCsv).toHaveBeenCalledWith('preview-1', expect.any(Object));
  });
});

async function uploadFile(
  userSession: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  name: string
) {
  const fileInput = container.querySelector('input[type="file"]');
  if (!(fileInput instanceof HTMLInputElement)) {
    throw new Error('file input not found');
  }
  const file = new File(['fake'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  await userSession.upload(fileInput, file);
}

function createImportsClient(overrides: Partial<ImportsClient>): ImportsClient {
  return {
    confirmImport: () => Promise.resolve(report),
    downloadErrorsCsv: () => Promise.resolve(new Blob(['csv'])),
    downloadTemplate: () => Promise.resolve(new Blob(['template'])),
    previewImport: () => Promise.resolve(preview),
    ...overrides,
  };
}
