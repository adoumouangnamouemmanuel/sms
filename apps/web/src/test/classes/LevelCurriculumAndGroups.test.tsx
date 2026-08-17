import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  LevelCurriculumsResponse,
  SubjectGroupsResponse,
  SubjectGroupView,
} from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { LevelCurriculumView } from '../../modules/classes/LevelCurriculumView';
import { SubjectGroupsView } from '../../modules/classes/SubjectGroupsView';
import type { ClassesClient } from '../../modules/classes/useClassesState';

const levelSixId = '00000000-0000-4000-8000-00000000b101';
const subjectMathId = '00000000-0000-4000-8000-00000000b501';
const subjectFrenchId = '00000000-0000-4000-8000-00000000b502';

const subject = (id: string, code: string, name: string) => ({
  id,
  schoolId: '00000000-0000-4000-8000-000000000101',
  code,
  name,
  nameEn: null,
  nameAr: null,
  shortLabel: null,
  category: 'MATHEMATIQUES' as const,
  isActive: true,
  recordVersion: 1,
});

const levelCurriculumFixture: LevelCurriculumsResponse = {
  items: [
    {
      levelId: levelSixId,
      levelCode: '6E',
      levelName: 'Sixième',
      entries: [
        {
          subjectId: subjectMathId,
          subjectCode: 'MATH',
          subjectName: 'Mathématiques',
          subjectCategory: 'MATHEMATIQUES',
          coefficient: 4,
          isRequired: true,
        },
      ],
    },
  ],
};

const groupsFixture: SubjectGroupsResponse = {
  items: [
    {
      id: '00000000-0000-4000-8000-00000000c001',
      schoolId: '00000000-0000-4000-8000-000000000101',
      name: 'Matières scientifiques',
      nameEn: null,
      nameAr: null,
      displayOrder: 1,
      isActive: true,
      recordVersion: 1,
      subjectCount: 1,
    },
  ],
};

const unexpectedClientCall = (): Promise<never> =>
  Promise.reject(new Error('Unexpected ClassesClient method call'));

function createClient(overrides: Partial<ClassesClient> = {}): ClassesClient {
  return {
    archiveClassroom: unexpectedClientCall,
    archiveSubject: () => Promise.resolve(subject(subjectMathId, 'MATH', 'Mathématiques')),
    assignClassSubject: unexpectedClientCall,
    confirmCurriculumCopy: () => Promise.resolve({ assigned: 1, skipped: 0 }),
    createClassroom: unexpectedClientCall,
    createSubject: () => Promise.resolve(subject(subjectMathId, 'MATH', 'Mathématiques')),
    enrolOptionalSubjects: () => Promise.resolve([]),
    enrolStudents: () => Promise.resolve({ classroomId: '', imported: 0, skipped: [] }),
    exportRegister: () => Promise.resolve({ classroomLabel: '', filename: '', content: '' }),
    getClassroomRoster: unexpectedClientCall,
    listStudentsMissingClass: unexpectedClientCall,
    previewCurriculumCopy: unexpectedClientCall,
    transferStudent: () => Promise.resolve({ closed: {}, opened: {} }),
    reactivateClassroom: unexpectedClientCall,
    reactivateSubject: () => Promise.resolve(subject(subjectMathId, 'MATH', 'Mathématiques')),
    removeClassSubject: unexpectedClientCall,
    updateClassroom: unexpectedClientCall,
    updateClassSubject: unexpectedClientCall,
    updateSubject: () => Promise.resolve(subject(subjectMathId, 'MATH', 'Mathématiques')),
    listClassrooms: () => Promise.resolve({ items: [], total: 0, limit: 100, offset: 0 }),
    listClassSubjects: () => Promise.resolve([]),
    listSubjects: () =>
      Promise.resolve({
        items: [
          subject(subjectMathId, 'MATH', 'Mathématiques'),
          subject(subjectFrenchId, 'FR', 'Français'),
        ],
        total: 2,
        limit: 100,
        offset: 0,
      }),
    ...overrides,
  };
}

describe('LevelCurriculumView (roadmap §9.5)', () => {
  it('renders the level matrix with the mapped subject and its coefficient', async () => {
    render(
      <LevelCurriculumView
        apiBaseUrl={null}
        client={createClient({
          listLevelCurriculums: vi.fn().mockResolvedValue(levelCurriculumFixture),
        })}
      />
    );

    expect(await screen.findByText('Programme par niveau')).toBeInTheDocument();
    expect(screen.getByText('Sixième')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques')).toBeInTheDocument();
    expect(screen.getByText('Obligatoire')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });

  it('saves the matrix with the chosen coefficient through the client seam', async () => {
    const user = userEvent.setup();
    const saveLevelCurriculum = vi.fn().mockResolvedValue(levelCurriculumFixture);

    render(
      <LevelCurriculumView
        apiBaseUrl={null}
        client={createClient({
          listLevelCurriculums: vi.fn().mockResolvedValue(levelCurriculumFixture),
          saveLevelCurriculum,
        })}
      />
    );

    expect(await screen.findByText('Mathématiques')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('4'), { target: { value: '5' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(saveLevelCurriculum).toHaveBeenCalledWith(
        {
          levelId: levelSixId,
          entries: [{ subjectId: subjectMathId, coefficient: 5, isRequired: true }],
        },
        expect.anything()
      );
    });
  });
});

describe('SubjectGroupsView (roadmap §9.6)', () => {
  it('renders the group list and its member count', async () => {
    render(
      <SubjectGroupsView
        apiBaseUrl={null}
        client={createClient({ listSubjectGroups: vi.fn().mockResolvedValue(groupsFixture) })}
      />
    );

    expect((await screen.findAllByText('Matières scientifiques')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 matière(s)')).toBeInTheDocument();
  });

  it('adds a subject to the group and saves the membership order', async () => {
    const user = userEvent.setup();
    const setSubjectGroupMembers = vi.fn().mockResolvedValue({ members: [] });
    const listSubjectGroupMembers = vi.fn().mockResolvedValue({
      members: [
        {
          subjectId: subjectMathId,
          subjectCode: 'MATH',
          subjectName: 'Mathématiques',
          displayOrder: 1,
        },
      ],
    });

    render(
      <SubjectGroupsView
        apiBaseUrl={null}
        client={createClient({
          listSubjectGroups: vi.fn().mockResolvedValue(groupsFixture),
          listSubjectGroupMembers,
          setSubjectGroupMembers,
        })}
      />
    );

    expect((await screen.findAllByText('Matières scientifiques')).length).toBeGreaterThanOrEqual(1);

    // The group is auto-selected; its member (Mathématiques) is listed.
    expect(await screen.findByText('Mathématiques')).toBeInTheDocument();

    // Add the second subject from the available chips.
    await user.click(screen.getByRole('button', { name: '+ Français' }));
    expect(screen.getByText('Français')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => {
      expect(setSubjectGroupMembers).toHaveBeenCalledWith(
        groupsFixture.items[0]?.id,
        { subjectIds: [subjectMathId, subjectFrenchId] },
        expect.anything()
      );
    });
  });

  it('opens the create-group modal and submits the name', async () => {
    const user = userEvent.setup();
    const baseGroup = groupsFixture.items[0];
    if (baseGroup === undefined) {
      throw new Error('Expected the groups fixture to contain one group.');
    }

    const created: SubjectGroupView = {
      ...baseGroup,
      id: '00000000-0000-4000-8000-00000000c002',
      name: 'Matières littéraires',
    };
    const createSubjectGroup = vi.fn().mockResolvedValue(created);

    render(
      <SubjectGroupsView
        apiBaseUrl={null}
        client={createClient({
          listSubjectGroups: vi.fn().mockResolvedValue({ items: [] }),
          createSubjectGroup,
        })}
      />
    );

    expect(await screen.findByText('Aucun groupe de matières pour le moment.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nouveau groupe' }));
    expect(screen.getByRole('heading', { name: 'Nouveau groupe de matières' })).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('Ex. Matières scientifiques'),
      'Matières littéraires'
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(createSubjectGroup).toHaveBeenCalledWith(
        { name: 'Matières littéraires', nameEn: null, nameAr: null, displayOrder: 1 },
        expect.anything()
      );
    });
  });
});
