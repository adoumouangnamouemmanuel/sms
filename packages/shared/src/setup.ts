import { z } from 'zod';

export const SCHOOL_SETUP_STATUSES = [
  'PENDING',
  'PROFILE_COMPLETED',
  'CALENDAR_COMPLETED',
  'CLASS_LEVELS_COMPLETED',
  'COMPLETED',
] as const;
export type SchoolSetupStatus = (typeof SCHOOL_SETUP_STATUSES)[number];

export const TERM_SYSTEMS = ['TRIMESTER', 'SEMESTER'] as const;
export type TermSystem = (typeof TERM_SYSTEMS)[number];

export const IMPLEMENTED_SCHOOL_MODULES = [
  'SCHOOL_SETUP',
  'ACADEMIC_STRUCTURE',
  'STUDENTS',
  'TEACHERS',
] as const;
export type SchoolModuleName = (typeof IMPLEMENTED_SCHOOL_MODULES)[number];

export const SETUP_STEP_IDS = ['profile', 'calendar', 'classLevels', 'review'] as const;
export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export const defaultSchoolConfiguration = {
  country: 'TD',
  currency: 'XAF',
  locale: 'fr',
  timezone: 'Africa/Ndjamena',
} as const;

function emptyStringToNull(value: unknown) {
  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  return value;
}

// Optional setup fields come from controlled forms, where blanks mean "not set".
export const setupNullableTextSchema = z.preprocess(
  emptyStringToNull,
  z.string().trim().max(255).nullable().optional()
);
const setupNullableLongTextSchema = z.preprocess(
  emptyStringToNull,
  z.string().trim().max(500).nullable().optional()
);
const setupOptionalUrlSchema = z.preprocess(
  emptyStringToNull,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  z.string().trim().url().max(500).nullable().optional()
);
const setupOptionalEmailSchema = z.preprocess(
  emptyStringToNull,
  z.email().max(190).nullable().optional()
);
const setupNullableMottoSchema = z.preprocess(
  emptyStringToNull,
  z.string().trim().max(240).nullable().optional()
);

export const setupSchoolProfileRequestSchema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: setupNullableTextSchema,
  logoUrl: setupOptionalUrlSchema,
  address: setupNullableLongTextSchema,
  city: z.string().trim().min(1).max(120),
  phone: setupNullableTextSchema,
  email: setupOptionalEmailSchema,
  motto: setupNullableMottoSchema,
  ministryCode: setupNullableTextSchema,
});

export const setupTermInputSchema = z.object({
  label: z.string().trim().min(2).max(80),
  termNumber: z.number().int().min(1).max(3),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  isCurrent: z.boolean(),
});

export const setupCalendarRequestSchema = z.object({
  academicYear: z.object({
    label: z.string().trim().min(4).max(40),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }),
  termSystem: z.enum(TERM_SYSTEMS),
  terms: z.array(setupTermInputSchema).min(2).max(3),
});

export const setupClassLevelInputSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  displayOrder: z.number().int().min(1).max(50),
  isExamYear: z.boolean(),
});

export const setupClassLevelsRequestSchema = z.object({
  classLevels: z.array(setupClassLevelInputSchema).min(1).max(20),
});

export const setupSchoolSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().nullable(),
  logoUrl: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().min(1),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  motto: z.string().nullable(),
  ministryCode: z.string().nullable(),
  locale: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  setupStatus: z.enum(SCHOOL_SETUP_STATUSES),
});

export const setupAcademicYearSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  label: z.string().min(1),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
});

export const setupTermSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  label: z.string().min(1),
  termNumber: z.number().int().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
});

export const setupClassLevelSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  displayOrder: z.number().int().min(1),
  isExamYear: z.boolean(),
  isActive: z.boolean(),
});

export const setupModuleConfigSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  moduleName: z.enum(IMPLEMENTED_SCHOOL_MODULES),
  isEnabled: z.boolean(),
});

export const setupStateResponseSchema = z.object({
  school: setupSchoolSchema,
  academicYear: setupAcademicYearSchema.nullable(),
  termSystem: z.enum(TERM_SYSTEMS).nullable(),
  terms: z.array(setupTermSchema),
  classLevels: z.array(setupClassLevelSchema),
  enabledModules: z.array(setupModuleConfigSchema),
  nextStep: z.enum(SETUP_STEP_IDS),
});

export type SetupSchoolProfileRequest = z.infer<typeof setupSchoolProfileRequestSchema>;
export type SetupCalendarRequest = z.infer<typeof setupCalendarRequestSchema>;
export type SetupClassLevelsRequest = z.infer<typeof setupClassLevelsRequestSchema>;
export type SetupTermInput = z.infer<typeof setupTermInputSchema>;
export type SetupClassLevelInput = z.infer<typeof setupClassLevelInputSchema>;
export type SetupStateResponse = z.infer<typeof setupStateResponseSchema>;
