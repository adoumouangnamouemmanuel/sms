/** Formats an ISO date (YYYY-MM-DD) as DD/MM/YYYY, the standard for this app's locales. */
export function formatISODate(value: string): string {
  if (!value) {
    return '';
  }
  return value.split('-').reverse().join('/');
}
