import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  TeacherLoginCreatedResponse,
  TeacherListQuery,
  TeacherProfileResponse,
  TeacherResponse,
} from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import { TeachersModule } from '../modules/teachers/TeachersModule';
import type { TeachersClient } from '../modules/teachers/useTeachersState';

const teacher: TeacherResponse = {
  id: '00000000-0000-4000-8000-000000000501',
  schoolId: '00000000-0000-4000-8000-000000000201',
  code: 'NDS-DEMO-2026-X001',
  firstName: 'Jean',
  lastName: 'Nguet',
  specialization: 'Mathématiques',
  hireDate: '2015-09-01',
  phone: '+23500000020',
  email: 'j.nguet@example.com',
  address: null,
  userId: null,
  isActive: true,
  recordVersion: 1,
};

const archivedTeacher: TeacherResponse = { ...teacher, isActive: false };

const credentials: TeacherLoginCreatedResponse = {
  userId: '00000000-0000-4000-8000-000000000601',
  username: 'nguet.jean',
  initialPassword: 'Tmp-9f3k!qz',
};

const teacherProfile: TeacherProfileResponse = {
  teacher,
  login: null,
};

const teacherProfileWithLogin: TeacherProfileResponse = {
  teacher,
  login: {
    userId: credentials.userId,
    username: credentials.username,
    isActive: true,
  },
};

describe('TeachersModule', () => {
  it('loads and renders the teachers list', async () => {
    const client = createTeachersClient({
      listTeachers: vi.fn().mockResolvedValue({ items: [teacher], total: 1, limit: 20, offset: 0 }),
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    expect(await screen.findByText('Nguet Jean')).toBeInTheDocument();
    expect(screen.getByText('NDS-DEMO-2026-X001')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques')).toBeInTheDocument();
    expect(screen.getByText('1 résultat(s)')).toBeInTheDocument();
  });

  it('filters the list by archived status', async () => {
    const userSession = userEvent.setup();
    const listTeachers = vi
      .fn()
      .mockImplementation((query: TeacherListQuery) =>
        Promise.resolve(
          query.status === 'archived'
            ? { items: [archivedTeacher], total: 1, limit: 20, offset: 0 }
            : { items: [teacher], total: 1, limit: 20, offset: 0 }
        )
      );
    const client = createTeachersClient({ listTeachers });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Nguet Jean');
    await userSession.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), 'archived');

    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(listTeachers).toHaveBeenLastCalledWith(
      { search: '', status: 'archived', limit: 20, offset: 0 },
      expect.any(Object)
    );
  });

  it('creates a teacher through the form modal', async () => {
    const userSession = userEvent.setup();
    const createTeacher = vi.fn().mockResolvedValue(teacher);
    const client = createTeachersClient({
      createTeacher,
      listTeachers: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Aucun professeur trouvé.');
    await userSession.click(screen.getByRole('button', { name: 'Nouveau professeur' }));

    expect(screen.getByRole('textbox', { name: 'Code' })).toBeInTheDocument();
    expect(screen.queryByText(/optionnel/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date d’embauche')).toBeInTheDocument();

    await userSession.type(screen.getByRole('textbox', { name: 'Prénom *' }), 'Jean');
    await userSession.type(screen.getByRole('textbox', { name: 'Nom *' }), 'Nguet');
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(createTeacher).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Jean', lastName: 'Nguet' }),
      expect.any(Object)
    );
  });

  it('shows generated credentials exactly once after creating a login', async () => {
    const userSession = userEvent.setup();
    const createTeacherLogin = vi.fn().mockResolvedValue(credentials);
    const client = createTeachersClient({
      createTeacherLogin,
      getTeacherProfile: vi.fn().mockResolvedValue(teacherProfile),
      listTeachers: vi.fn().mockResolvedValue({ items: [teacher], total: 1, limit: 20, offset: 0 }),
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Nguet Jean');
    await userSession.click(screen.getByRole('button', { name: 'Nguet Jean' }));
    await userSession.click(await screen.findByRole('button', { name: 'Créer un compte' }));

    expect(createTeacherLogin).toHaveBeenCalledWith(teacher.id, expect.any(Object));
    expect(await screen.findByText('nguet.jean')).toBeInTheDocument();
    expect(screen.getByText('Tmp-9f3k!qz')).toBeInTheDocument();
    expect(
      screen.getByText('Ces identifiants ne seront affichés qu’une seule fois.')
    ).toBeInTheDocument();
  });

  it('requires a reason before deactivating a login', async () => {
    const userSession = userEvent.setup();
    const deactivateTeacherLogin = vi.fn().mockResolvedValue({
      teacher,
      login: { userId: credentials.userId, username: credentials.username, isActive: false },
    });
    const client = createTeachersClient({
      deactivateTeacherLogin,
      getTeacherProfile: vi.fn().mockResolvedValue(teacherProfileWithLogin),
      listTeachers: vi.fn().mockResolvedValue({ items: [teacher], total: 1, limit: 20, offset: 0 }),
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Nguet Jean');
    await userSession.click(screen.getByRole('button', { name: 'Nguet Jean' }));
    await userSession.click(await screen.findByRole('button', { name: 'Désactiver le compte' }));

    const dialog = await screen.findByRole('dialog');
    await userSession.click(within(dialog).getByRole('button', { name: 'Désactiver le compte' }));

    expect(
      await screen.findByText('Le motif est requis (3 caractères minimum).')
    ).toBeInTheDocument();
    expect(deactivateTeacherLogin).not.toHaveBeenCalled();

    await userSession.type(
      within(dialog).getByRole('textbox', { name: /Motif/i }),
      'Contrat terminé'
    );
    await userSession.click(within(dialog).getByRole('button', { name: 'Désactiver le compte' }));

    expect(deactivateTeacherLogin).toHaveBeenCalledWith(
      teacher.id,
      { reason: 'Contrat terminé' },
      expect.any(Object)
    );
  });

  it('resets a teacher password from the profile', async () => {
    const userSession = userEvent.setup();
    const resetTeacherPassword = vi.fn().mockResolvedValue({ success: true, data: { user: {} } });
    const client = createTeachersClient({
      getTeacherProfile: vi.fn().mockResolvedValue(teacherProfileWithLogin),
      listTeachers: vi.fn().mockResolvedValue({ items: [teacher], total: 1, limit: 20, offset: 0 }),
      resetTeacherPassword,
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Nguet Jean');
    await userSession.click(screen.getByRole('button', { name: 'Nguet Jean' }));
    await userSession.click(
      await screen.findByRole('button', { name: 'Réinitialiser le mot de passe' })
    );

    const dialog = await screen.findByRole('dialog');
    await userSession.type(
      within(dialog).getByLabelText('Nouveau mot de passe'),
      'nouveau-pass-2026'
    );
    await userSession.type(
      within(dialog).getByLabelText('Confirmer le nouveau mot de passe'),
      'nouveau-pass-2026'
    );
    await userSession.click(
      within(dialog).getByRole('button', { name: 'Réinitialiser le mot de passe' })
    );

    expect(resetTeacherPassword).toHaveBeenCalledWith(
      credentials.userId,
      { newPassword: 'nouveau-pass-2026' },
      expect.any(Object)
    );
    expect(await screen.findByText('Nguet Jean')).toBeInTheDocument();
  });

  it('requires a reason before archiving a teacher', async () => {
    const userSession = userEvent.setup();
    const archiveTeacher = vi.fn().mockResolvedValue(archivedTeacher);
    const client = createTeachersClient({
      archiveTeacher,
      listTeachers: vi.fn().mockResolvedValue({ items: [teacher], total: 1, limit: 20, offset: 0 }),
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Nguet Jean');
    await userSession.click(screen.getByRole('button', { name: 'Archiver' }));
    await userSession.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(
      await screen.findByText('Le motif est requis (3 caractères minimum).')
    ).toBeInTheDocument();
    expect(archiveTeacher).not.toHaveBeenCalled();

    await userSession.type(screen.getByRole('textbox', { name: /Motif/i }), 'Fin de contrat');
    await userSession.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(archiveTeacher).toHaveBeenCalledWith(
      teacher.id,
      { reason: 'Fin de contrat' },
      expect.any(Object)
    );
  });

  it('opens a teacher profile and shows the login account status', async () => {
    const userSession = userEvent.setup();
    const client = createTeachersClient({
      getTeacherProfile: vi.fn().mockResolvedValue(teacherProfileWithLogin),
      listTeachers: vi.fn().mockResolvedValue({ items: [teacher], total: 1, limit: 20, offset: 0 }),
    });

    render(<TeachersModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Nguet Jean');
    await userSession.click(screen.getByRole('button', { name: 'Nguet Jean' }));

    expect(await screen.findByText('Compte de connexion')).toBeInTheDocument();
    expect(screen.getByText('nguet.jean')).toBeInTheDocument();
    expect(screen.getAllByText('Actif').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Désactiver le compte' })).toBeInTheDocument();
  });
});

function createTeachersClient(overrides: Partial<TeachersClient>): TeachersClient {
  const emptyPage = { items: [], total: 0, limit: 20, offset: 0 };

  return {
    archiveTeacher: () => Promise.resolve(archivedTeacher),
    createTeacher: () => Promise.resolve(teacher),
    createTeacherLogin: () => Promise.resolve(credentials),
    deactivateTeacherLogin: () => Promise.resolve(teacherProfileWithLogin),
    getTeacherProfile: () => Promise.resolve(teacherProfile),
    listTeachers: () => Promise.resolve(emptyPage),
    reactivateTeacher: () => Promise.resolve(teacher),
    reactivateTeacherLogin: () => Promise.resolve(teacherProfileWithLogin),
    resetTeacherPassword: () => Promise.resolve({ success: true, data: { user: {} } }),
    updateTeacher: () => Promise.resolve(teacher),
    ...overrides,
  };
}
