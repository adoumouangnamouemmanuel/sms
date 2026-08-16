import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ClassroomView,
  ClassSubjectView,
  SetupStateResponse,
  StudentSubjectEnrollmentResponse,
  SubjectResponse,
} from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ClassesModule } from '../../modules/classes/ClassesModule';
import type { ClassesClient } from '../../modules/classes/useClassesState';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const subject: SubjectResponse = {
  id: '00000000-0000-4000-8000-000000000011',
  schoolId: '00000000-0000-4000-8000-000000000101',
  code: 'MATH',
  name: 'Mathématiques',
  nameEn: null,
  nameAr: null,
  shortLabel: null,
  category: 'MATHEMATIQUES',
  isActive: true,
  recordVersion: 1,
};

const classroomView: ClassroomView = {
  classroom: {
    id: '00000000-0000-4000-8000-000000000021',
    schoolId: '00000000-0000-4000-8000-000000000101',
    academicYearId: '00000000-0000-4000-8000-000000000401',
    classLevelId: '00000000-0000-4000-8000-000000000601',
    code: '6E-A',
    name: null,
    capacity: 40,
    isActive: true,
    recordVersion: 1,
  },
  classLevelCode: '6E',
  classLevelName: 'Sixième',
  isExamYear: false,
  academicYearLabel: '2026-2027',
  activeEnrollmentCount: 12,
};

const classSubjectView: ClassSubjectView = {
  classSubject: {
    id: '00000000-0000-4000-8000-000000000031',
    schoolId: '00000000-0000-4000-8000-000000000101',
    classroomId: classroomView.classroom.id,
    subjectId: subject.id,
    coefficient: 4,
    isRequired: true,
    teacherId: null,
    isActive: true,
    recordVersion: 1,
  },
  subjectCode: 'MATH',
  subjectName: 'Mathématiques',
  subjectCategory: 'MATHEMATIQUES',
  teacherName: null,
};

const optionalClassSubjectView: ClassSubjectView = {
  classSubject: {
    id: '00000000-0000-4000-8000-000000000032',
    schoolId: '00000000-0000-4000-8000-000000000101',
    classroomId: classroomView.classroom.id,
    subjectId: '00000000-0000-4000-8000-000000000012',
    coefficient: 2,
    isRequired: false,
    teacherId: null,
    isActive: true,
    recordVersion: 1,
  },
  subjectCode: 'ANG',
  subjectName: 'Anglais',
  subjectCategory: 'LANGUES',
  teacherName: null,
};

const studentSubjectEnrollment: StudentSubjectEnrollmentResponse = {
  id: '00000000-0000-4000-8000-000000000041',
  schoolId: '00000000-0000-4000-8000-000000000101',
  classEnrollmentId: '00000000-0000-4000-8000-000000000051',
  classSubjectId: optionalClassSubjectView.classSubject.id,
  isActive: true,
  recordVersion: 1,
};

function createSetupState(): SetupStateResponse {
  return {
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

function createClassesClient(overrides: Partial<ClassesClient> = {}): ClassesClient {
  return {
    archiveClassroom: () => Promise.resolve(classroomView),
    archiveSubject: () => Promise.resolve(subject),
    assignClassSubject: () => Promise.resolve(classSubjectView),
    confirmCurriculumCopy: () => Promise.resolve({ assigned: 1, skipped: 0 }),
    createClassroom: () => Promise.resolve(classroomView),
    createSubject: () => Promise.resolve(subject),
    enrolOptionalSubjects: () => Promise.resolve([studentSubjectEnrollment]),
    enrolStudents: () =>
      Promise.resolve({ classroomId: classroomView.classroom.id, imported: 1, skipped: [] }),
    exportRegister: () =>
      Promise.resolve({ classroomLabel: 'Sixième 6E-A', filename: 'registre.csv', content: 'a,b' }),
    getClassroomRoster: () =>
      Promise.resolve({
        classroom: classroomView,
        capacity: 40,
        enrolledCount: 1,
        entries: [
          {
            enrollment: {
              id: '00000000-0000-4000-8000-000000000051',
              schoolId: '00000000-0000-4000-8000-000000000101',
              studentId: '00000000-0000-4000-8000-000000000061',
              classroomId: classroomView.classroom.id,
              academicYearId: '00000000-0000-4000-8000-000000000401',
              status: 'ACTIVE',
              enrollmentDate: '2026-09-01',
              exitDate: null,
              reason: null,
              recordVersion: 1,
            },
            student: {
              id: '00000000-0000-4000-8000-000000000061',
              code: 'NDS-DEMO-2026-001',
              firstName: 'Aminata',
              lastName: 'Mahamat',
              sex: 'F',
              dateOfBirth: '2012-03-14',
            },
          },
        ],
      }),
    listClassrooms: () =>
      Promise.resolve({ items: [classroomView], total: 1, limit: 100, offset: 0 }),
    listClassSubjects: () => Promise.resolve([classSubjectView, optionalClassSubjectView]),
    listLevelCurriculums: () =>
      Promise.resolve({
        items: [
          {
            levelId: classroomView.classroom.classLevelId,
            levelCode: '6E',
            levelName: 'Sixième',
            entries: [
              {
                subjectId: subject.id,
                coefficient: 4,
                isRequired: true,
                subjectCode: 'MATH',
                subjectName: 'Mathématiques',
                subjectCategory: 'MATHEMATIQUES',
              },
            ],
          },
        ],
      }),
    listStudentsMissingClass: () =>
      Promise.resolve({
        academicYearId: '00000000-0000-4000-8000-000000000401',
        academicYearLabel: '2026-2027',
        students: [
          {
            id: '00000000-0000-4000-8000-000000000061',
            code: 'NDS-DEMO-2026-001',
            firstName: 'Aminata',
            lastName: 'Mahamat',
          },
        ],
        total: 1,
      }),
    listSubjects: () => Promise.resolve({ items: [subject], total: 1, limit: 50, offset: 0 }),
    previewCurriculumCopy: () =>
      Promise.resolve({
        sourceClassroomId: classroomView.classroom.id,
        sourceClassroomLabel: 'Sixième 6E-A',
        targetClassroomId: classroomView.classroom.id,
        targetClassroomLabel: 'Sixième 6E-A',
        items: [],
        newCount: 0,
        skippedCount: 1,
      }),
    reactivateClassroom: () => Promise.resolve(classroomView),
    reactivateSubject: () => Promise.resolve(subject),
    removeClassSubject: () => Promise.resolve(classSubjectView),
    transferStudent: () => Promise.resolve({ closed: {}, opened: {} }),
    updateClassroom: () => Promise.resolve(classroomView),
    updateClassSubject: () => Promise.resolve(classSubjectView),
    updateSubject: () => Promise.resolve(subject),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClassesModule', () => {
  it('renders the classrooms tab with class cards and headcounts', async () => {
    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createClassesClient()}
        setupState={createSetupState()}
      />
    );

    expect(screen.getByText('Classes & programmes')).toBeInTheDocument();
    expect(await screen.findByText('Sixième 6E-A')).toBeInTheDocument();
    expect(screen.getByText('12/40 élèves')).toBeInTheDocument();
    expect(screen.getByText('1 classe(s)')).toBeInTheDocument();
  });

  it('opens a class detail showing the roster and the assigned curriculum', async () => {
    const userSession = userEvent.setup();
    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createClassesClient()}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('button', { name: /Sixième 6E-A/ }));

    expect(await screen.findByText('Effectif')).toBeInTheDocument();
    expect(screen.getByText('Mahamat Aminata')).toBeInTheDocument();
    expect(screen.getByText('Programme de la classe')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques')).toBeInTheDocument();
    expect(screen.getByText('Obligatoire')).toBeInTheDocument();
  });

  it('prefills the coefficient from the level curriculum when assigning a subject', async () => {
    const userSession = userEvent.setup();
    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createClassesClient()}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('button', { name: /Sixième 6E-A/ }));
    await userSession.click(await screen.findByRole('button', { name: 'Affecter une matière' }));

    // Pick Mathématiques: the coefficient input is prefilled from the level
    // curriculum (4) instead of defaulting to 1, with a hint naming the level.
    const dialog = await screen.findByRole('dialog');
    await userSession.selectOptions(await within(dialog).findByLabelText('Matière *'), subject.id);
    expect(within(dialog).getByLabelText(/Coefficient/)).toHaveValue(4);
    expect(
      await within(dialog).findByText(/Coefficient du niveau Sixième : 4/)
    ).toBeInTheDocument();
  });

  it('assigns an optional subject to a student from the roster', async () => {
    const userSession = userEvent.setup();
    const enrolOptionalSubjects = vi.fn().mockResolvedValue([studentSubjectEnrollment]);
    const client = createClassesClient({ enrolOptionalSubjects });

    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('button', { name: /Sixième 6E-A/ }));
    await userSession.click(await screen.findByRole('button', { name: 'Options' }));
    await userSession.click(await screen.findByLabelText(/Anglais/));
    await userSession.click(screen.getByRole('button', { name: 'Inscrire' }));

    expect(enrolOptionalSubjects).toHaveBeenCalledWith(
      expect.objectContaining({
        classroomId: classroomView.classroom.id,
        studentId: '00000000-0000-4000-8000-000000000061',
        classSubjectIds: [optionalClassSubjectView.classSubject.id],
      }),
      expect.any(Object)
    );
  });

  it('switches to the subjects tab and shows the catalogue', async () => {
    const userSession = userEvent.setup();
    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createClassesClient()}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('tab', { name: 'Matières' }));

    expect(await screen.findByText('MATH')).toBeInTheDocument();
    expect(screen.getAllByText('Mathématiques').length).toBeGreaterThan(0);
    expect(screen.getByText('1 matière(s)')).toBeInTheDocument();
  });

  it('creates a subject through the form modal', async () => {
    const userSession = userEvent.setup();
    const createSubject = vi.fn().mockResolvedValue(subject);
    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createClassesClient({ createSubject })}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('tab', { name: 'Matières' }));
    await userSession.click(await screen.findByRole('button', { name: 'Nouvelle matière' }));
    await userSession.type(screen.getByRole('textbox', { name: 'Code *' }), 'FR');
    await userSession.type(screen.getByRole('textbox', { name: 'Nom *' }), 'Français');
    await userSession.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(createSubject).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FR', name: 'Français' }),
      expect.any(Object)
    );
  });

  it('shows students missing a class and enrols them in bulk', async () => {
    const userSession = userEvent.setup();
    const enrolStudents = vi.fn().mockResolvedValue({
      classroomId: classroomView.classroom.id,
      imported: 1,
      skipped: [],
    });
    const client = createClassesClient({ enrolStudents });

    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('tab', { name: 'Inscription' }));

    expect(await screen.findByText('Inscription groupée')).toBeInTheDocument();
    expect(screen.getByText('Mahamat Aminata')).toBeInTheDocument();
    expect(screen.getByText('Élèves sans classe')).toBeInTheDocument();

    await userSession.click(screen.getByLabelText(/Mahamat Aminata/));
    await userSession.selectOptions(
      screen.getByRole('combobox', { name: 'Classe cible *' }),
      classroomView.classroom.id
    );
    await userSession.click(screen.getByRole('button', { name: 'Inscrire' }));

    expect(enrolStudents).toHaveBeenCalledWith(
      {
        classroomId: classroomView.classroom.id,
        studentIds: ['00000000-0000-4000-8000-000000000061'],
      },
      expect.any(Object)
    );
  });

  it('renders the levels tab with real levels from setup', async () => {
    const userSession = userEvent.setup();
    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={createClassesClient()}
        setupState={createSetupState()}
      />
    );

    await userSession.click(await screen.findByRole('tab', { name: 'Niveaux' }));

    expect(await screen.findByText('Sixième')).toBeInTheDocument();
    expect(screen.getByText('1 classe(s)')).toBeInTheDocument();
  });

  it('requires a reason before archiving a classroom', async () => {
    const userSession = userEvent.setup();
    const archiveClassroom = vi.fn().mockResolvedValue(classroomView);
    const client = createClassesClient({ archiveClassroom });

    render(
      <ClassesModule
        apiBaseUrl="http://127.0.0.1:49152"
        client={client}
        setupState={createSetupState()}
      />
    );

    await screen.findByText('Sixième 6E-A');
    await userSession.click(screen.getByRole('button', { name: /Sixième 6E-A/ }));
    await userSession.click(await screen.findByRole('button', { name: 'Archiver' }));

    const dialog = await screen.findByRole('dialog');
    await userSession.click(within(dialog).getByRole('button', { name: 'Archiver' }));

    expect(
      await within(dialog).findByText('Un motif est requis (au moins 3 caractères).')
    ).toBeInTheDocument();
    expect(archiveClassroom).not.toHaveBeenCalled();

    await userSession.type(
      within(dialog).getByRole('textbox', { name: /Motif/i }),
      'Classe fermee cette annee'
    );
    await userSession.click(within(dialog).getByRole('button', { name: 'Archiver' }));

    expect(archiveClassroom).toHaveBeenCalledWith(
      classroomView.classroom.id,
      { reason: 'Classe fermee cette annee' },
      expect.any(Object)
    );
  });
});
