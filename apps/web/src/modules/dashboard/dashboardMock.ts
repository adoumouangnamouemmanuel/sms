import type { SetupClassLevel } from '@edutrack/shared';

// ---------------------------------------------------------------------------
// SIMULATED DATA — everything below this line is mock.
//
// TODO(roadmap §Classes): once the Classes + enrollment module ships, replace
// `buildMockClassDistribution` with the real per-class student counts queried
// from the enrollment relationship.
// TODO(roadmap §Audit/Rapports): once the audit/notifications module ships,
// replace `MOCK_RECENT_ACTIVITY` with real events from the audit log.
// ---------------------------------------------------------------------------

export interface MockLevelDistribution {
  levelId: string;
  levelName: string;
  classes: number;
  students: number;
}

const MOCK_CLASSES_PER_LEVEL = 2;
// Deterministic pseudo-random effectifs so the dashboard is stable across
// reloads instead of jittering numbers.
const MOCK_STUDENTS_BASE = 28;

/** Derives a plausible per-level class/effectif breakdown from the real levels. */
export function buildMockClassDistribution(
  classLevels: SetupClassLevel[]
): MockLevelDistribution[] {
  return classLevels.map((level, index) => ({
    levelId: level.id,
    levelName: level.name,
    classes: MOCK_CLASSES_PER_LEVEL,
    students: MOCK_STUDENTS_BASE + ((index * 7) % 21),
  }));
}

export interface MockActivityEvent {
  id: string;
  labelKey: string;
  /** Translated detail via i18n interpolation; see dashboard.activity.* keys. */
  timeKey: string;
}

export const MOCK_RECENT_ACTIVITY: MockActivityEvent[] = [
  {
    id: 'act-1',
    labelKey: 'dashboard.activity.studentsImported',
    timeKey: 'dashboard.activity.today',
  },
  {
    id: 'act-2',
    labelKey: 'dashboard.activity.teacherLogin',
    timeKey: 'dashboard.activity.yesterday',
  },
  {
    id: 'act-3',
    labelKey: 'dashboard.activity.studentArchived',
    timeKey: 'dashboard.activity.twoDaysAgo',
  },
  { id: 'act-4', labelKey: 'dashboard.activity.termOpened', timeKey: 'dashboard.activity.weekAgo' },
];
