export const VERSION_ONE_DOMAIN_MODULES = [
  'installation',
  'authentication',
  'people',
  'curriculum',
  'results',
  'dataSafety',
] as const;

export type VersionOneDomainModule = (typeof VERSION_ONE_DOMAIN_MODULES)[number];

export * from './academic-year.js';
export * from './configuration.js';
export * from './grading-policy.js';
