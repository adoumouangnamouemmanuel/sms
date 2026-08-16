import type {
  SetupCalendarRequest,
  SetupClassLevelInput,
  SetupSchoolProfileRequest,
  SetupStateResponse,
  SetupStepId,
  SetupTermInput,
  TermSystem,
} from '@edutrack/shared';

export const setupStepOrder: SetupStepId[] = [
  'profile',
  'calendar',
  'classLevels',
  'subjects',
  'groups',
  'grading',
  'appreciation',
  'review',
];

export const defaultClassLevels: SetupClassLevelInput[] = [
  { code: '6E', name: 'Sixi\u00e8me', displayOrder: 1, isExamYear: false },
  { code: '5E', name: 'Cinqui\u00e8me', displayOrder: 2, isExamYear: false },
  { code: '4E', name: 'Quatri\u00e8me', displayOrder: 3, isExamYear: false },
  { code: '3E', name: 'Troisi\u00e8me', displayOrder: 4, isExamYear: true },
  { code: '2NDE', name: 'Seconde', displayOrder: 5, isExamYear: false },
  { code: '1ERE', name: 'Premi\u00e8re', displayOrder: 6, isExamYear: false },
  { code: 'TLE', name: 'Terminale', displayOrder: 7, isExamYear: true },
];

export function createProfileDraft(state: SetupStateResponse): SetupSchoolProfileRequest {
  return {
    name: state.school.name,
    shortName: state.school.shortName ?? '',
    logoUrl: state.school.logoUrl ?? '',
    address: state.school.address ?? '',
    city: state.school.city ?? 'N Djamena',
    phone: state.school.phone ?? '',
    email: state.school.email ?? '',
    motto: state.school.motto ?? '',
    ministryCode: state.school.ministryCode ?? '',
  };
}

export function createCalendarDraft(state: SetupStateResponse): SetupCalendarRequest {
  const currentYear = inferCurrentAcademicYear();
  const startDate = state.academicYear?.startDate ?? `${String(currentYear)}-09-01`;
  const endDate = state.academicYear?.endDate ?? `${String(currentYear + 1)}-06-30`;
  const termSystem = state.termSystem ?? 'TRIMESTER';

  return {
    academicYear: {
      label: state.academicYear?.label ?? `${String(currentYear)}-${String(currentYear + 1)}`,
      startDate,
      endDate,
    },
    termSystem,
    terms:
      state.terms.length > 0
        ? state.terms.map((term) => ({
            label: term.label,
            termNumber: term.termNumber,
            startDate: term.startDate,
            endDate: term.endDate,
            isCurrent: term.isCurrent,
          }))
        : createSuggestedTerms(termSystem, startDate, endDate),
  };
}

export function createClassLevelsDraft(state: SetupStateResponse): SetupClassLevelInput[] {
  return state.classLevels.length > 0
    ? state.classLevels.map((classLevel) => ({
        code: classLevel.code,
        name: classLevel.name,
        displayOrder: classLevel.displayOrder,
        isExamYear: classLevel.isExamYear,
      }))
    : defaultClassLevels;
}

export function createSuggestedTerms(
  termSystem: TermSystem,
  startDate: string,
  endDate: string
): SetupTermInput[] {
  const count = termSystem === 'TRIMESTER' ? 3 : 2;
  const totalDays = diffDays(startDate, endDate) + 1;
  const baseLength = Math.max(1, Math.floor(totalDays / count));

  return Array.from({ length: count }, (_item, index) => {
    const termStart = index === 0 ? startDate : addDays(startDate, baseLength * index);
    const termEnd =
      index === count - 1 ? endDate : addDays(startDate, baseLength * (index + 1) - 1);
    const termNumber = index + 1;

    return {
      label:
        termSystem === 'TRIMESTER'
          ? `Trimestre ${String(termNumber)}`
          : `Semestre ${String(termNumber)}`,
      termNumber,
      startDate: termStart,
      endDate: termEnd,
      isCurrent: index === 0,
    };
  });
}

export function canOpenStep(state: SetupStateResponse, stepId: SetupStepId) {
  return setupStepOrder.indexOf(stepId) <= setupStepOrder.indexOf(state.nextStep);
}

function inferCurrentAcademicYear() {
  const now = new Date();
  const year = now.getUTCFullYear();

  return now.getUTCMonth() >= 7 ? year : year - 1;
}

function diffDays(startDate: string, endDate: string) {
  return Math.max(
    0,
    Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000)
  );
}

function addDays(startDate: string, days: number) {
  const date = parseDate(startDate);
  date.setUTCDate(date.getUTCDate() + days);

  return formatDate(date);
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
