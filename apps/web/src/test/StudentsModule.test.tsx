import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  GuardianProfileResponse,
  GuardianResponse,
  StudentGuardianLinkResponse,
  StudentProfileResponse,
  StudentResponse,
} from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import { StudentsModule } from '../modules/students/StudentsModule';
import type { StudentsClient } from '../modules/students/useStudentsState';

const student: StudentResponse = {
  id: '00000000-0000-4000-8000-000000000101',
  schoolId: '00000000-0000-4000-8000-000000000201',
  code: 'NDS-DEMO-2026-001',
  firstName: 'Aminata',
  lastName: 'Mahamat',
  sex: 'F',
  dateOfBirth: '2012-03-14',
  placeOfBirth: null,
  nationality: 'Tchadienne',
  photoUrl: null,
  phone: null,
  email: null,
  address: null,
  isActive: true,
  recordVersion: 1,
};

const guardian: GuardianResponse = {
  id: '00000000-0000-4000-8000-000000000301',
  schoolId: '00000000-0000-4000-8000-000000000201',
  firstName: 'Fatime',
  lastName: 'Abakar',
  phone: '+23500000010',
  email: null,
  address: null,
  isActive: true,
  recordVersion: 1,
};

const primaryLink: StudentGuardianLinkResponse = {
  id: '00000000-0000-4000-8000-000000000401',
  studentId: student.id,
  guardianId: guardian.id,
  relationshipType: 'MERE',
  isPrimary: true,
  isEmergency: false,
  notes: null,
  recordVersion: 1,
};

const studentProfile: StudentProfileResponse = {
  student,
  guardians: [{ link: primaryLink, guardian }],
};

const guardianProfile: GuardianProfileResponse = {
  guardian,
  students: [
    {
      link: {
        id: '00000000-0000-4000-8000-000000000401',
        studentId: student.id,
        guardianId: guardian.id,
        relationshipType: 'MERE',
        isPrimary: true,
        isEmergency: false,
        notes: null,
        recordVersion: 1,
      },
      student,
    },
  ],
};

describe('StudentsModule', () => {
  it('loads and renders the students list', async () => {
    const client = createStudentsClient({
      listStudents: vi.fn().mockResolvedValue({ items: [student], total: 1, limit: 20, offset: 0 }),
      listGuardians: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<StudentsModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    expect(await screen.findByText('Mahamat Aminata')).toBeInTheDocument();
    expect(screen.getByText('NDS-DEMO-2026-001')).toBeInTheDocument();
    expect(screen.getByText('1 résultat(s)')).toBeInTheDocument();
  });

  it('searches students by name', async () => {
    const userSession = userEvent.setup();
    const listStudents = vi
      .fn()
      .mockResolvedValueOnce({ items: [student], total: 1, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    const client = createStudentsClient({
      listStudents,
      listGuardians: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<StudentsModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Mahamat Aminata');
    await userSession.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'Ousmane');
    await userSession.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(listStudents).toHaveBeenLastCalledWith(
      { search: 'Ousmane', limit: 20, offset: 0 },
      expect.any(Object)
    );
    expect(await screen.findByText('Aucun élève trouvé.')).toBeInTheDocument();
  });

  it('creates a student through the form modal', async () => {
    const userSession = userEvent.setup();
    const createStudent = vi.fn().mockResolvedValue(student);
    const client = createStudentsClient({
      createStudent,
      listStudents: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
      listGuardians: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<StudentsModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Aucun élève trouvé.');
    await userSession.click(screen.getByRole('button', { name: 'Nouvel élève' }));
    await userSession.type(screen.getByRole('textbox', { name: 'Prénom *' }), 'Aminata');
    await userSession.type(screen.getByRole('textbox', { name: 'Nom *' }), 'Mahamat');
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(createStudent).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Aminata', lastName: 'Mahamat' }),
      expect.any(Object)
    );
  });

  it('requires a reason before archiving a student', async () => {
    const userSession = userEvent.setup();
    const archiveStudent = vi.fn().mockResolvedValue({ ...student, isActive: false });
    const client = createStudentsClient({
      archiveStudent,
      listStudents: vi.fn().mockResolvedValue({ items: [student], total: 1, limit: 20, offset: 0 }),
      listGuardians: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<StudentsModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Mahamat Aminata');
    await userSession.click(screen.getByRole('button', { name: 'Archiver' }));
    await userSession.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(
      await screen.findByText('Le motif est requis (3 caractères minimum).')
    ).toBeInTheDocument();
    expect(archiveStudent).not.toHaveBeenCalled();

    await userSession.type(
      screen.getByRole('textbox', { name: /Motif/i }),
      'Transfert vers une autre ecole'
    );
    await userSession.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(archiveStudent).toHaveBeenCalledWith(
      student.id,
      { reason: 'Transfert vers une autre ecole' },
      expect.any(Object)
    );
  });

  it('opens a student profile and shows the linked guardian with primary badge', async () => {
    const userSession = userEvent.setup();
    const client = createStudentsClient({
      getStudentProfile: vi.fn().mockResolvedValue(studentProfile),
      listStudents: vi.fn().mockResolvedValue({ items: [student], total: 1, limit: 20, offset: 0 }),
      listGuardians: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<StudentsModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await screen.findByText('Mahamat Aminata');
    await userSession.click(screen.getByRole('button', { name: 'Mahamat Aminata' }));

    expect(await screen.findByText('Responsables liés')).toBeInTheDocument();
    expect(screen.getByText('Abakar Fatime')).toBeInTheDocument();
    expect(screen.getByText('Mère')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('switches to the guardians tab and shows sibling students in a guardian profile', async () => {
    const userSession = userEvent.setup();
    const client = createStudentsClient({
      getGuardianProfile: vi.fn().mockResolvedValue(guardianProfile),
      listStudents: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
      listGuardians: vi.fn().mockResolvedValue({
        items: [guardian],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    });

    render(<StudentsModule apiBaseUrl="http://127.0.0.1:49152" client={client} />);

    await userSession.click(await screen.findByRole('tab', { name: 'Responsables' }));
    expect(await screen.findByText('Abakar Fatime')).toBeInTheDocument();

    await userSession.click(screen.getByRole('button', { name: 'Abakar Fatime' }));
    expect(await screen.findByText('Élèves liés (fratrie)')).toBeInTheDocument();
    expect(screen.getByText('Mahamat Aminata')).toBeInTheDocument();
  });
});

function createStudentsClient(overrides: Partial<StudentsClient>): StudentsClient {
  const emptyPage = { items: [], total: 0, limit: 20, offset: 0 };

  return {
    archiveGuardian: () => Promise.resolve(guardian),
    archiveStudent: () => Promise.resolve(student),
    createGuardian: () => Promise.resolve(guardian),
    createStudent: () => Promise.resolve(student),
    getGuardianProfile: () => Promise.resolve(guardianProfile),
    getStudentProfile: () => Promise.resolve(studentProfile),
    linkGuardian: () => Promise.resolve(primaryLink),
    listGuardians: () => Promise.resolve(emptyPage),
    listStudents: () => Promise.resolve(emptyPage),
    reactivateGuardian: () => Promise.resolve(guardian),
    reactivateStudent: () => Promise.resolve(student),
    unlinkGuardian: () => Promise.resolve(primaryLink),
    updateGuardian: () => Promise.resolve(guardian),
    updateGuardianLink: () => Promise.resolve(primaryLink),
    updateStudent: () => Promise.resolve(student),
    ...overrides,
  };
}
