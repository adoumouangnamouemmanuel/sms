export const APP_NAME = 'EduTrack Africa';
export const DEFAULT_LOCALE = 'fr';
export const SUPPORTED_LOCALES = ['fr', 'ar', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
