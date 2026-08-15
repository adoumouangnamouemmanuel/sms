// ---------------------------------------------------------------------------
// SIMULATED DATA — mock classes per niveau.
//
// TODO(roadmap §Classes): the Classes + enrollment module will provide real
// class records and per-class headcounts. Until then the structure screen
// shows a deterministic preview so the hierarchy is tangible.
// ---------------------------------------------------------------------------

export interface MockClassCard {
  id: string;
  label: string;
  students: number;
}

const MOCK_CLASSES_PER_LEVEL = 2;
const MOCK_STUDENTS_BASE = 30;

export function buildMockClasses(levelId: string, levelName: string): MockClassCard[] {
  return Array.from({ length: MOCK_CLASSES_PER_LEVEL }, (_, index) => ({
    id: `${levelId}-mock-${String(index + 1)}`,
    label: `${levelName} ${String.fromCharCode(65 + index)}`,
    students: MOCK_STUDENTS_BASE + (((levelId.length + index) * 3) % 17),
  }));
}
