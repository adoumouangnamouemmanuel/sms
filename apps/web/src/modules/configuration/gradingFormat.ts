/**
 * Display <-> hundredths helpers shared by the grading-policy builder and the
 * appreciation editor. Marks, thresholds and bounds travel the API as integer
 * hundredths (AGENTS.md §8); the UI edits them as decimal strings (comma or
 * period accepted, normalized once).
 */

/**
 * Parse a decimal string (comma or period) to integer hundredths.
 *
 * Returns `null` for unparseable input instead of silently guessing a value:
 * an empty or malformed field must never commit 0 or the scale maximum — the
 * caller decides what "no value" means (AGENTS.md §9.1: zero is a valid grade
 * and never means missing).
 */
export function parseDecimalToHundredths(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round(parsed * 100));
}

export function formatHundredths(value: number): string {
  return (value / 100).toFixed(2).replace('.', ',');
}

export function parseWeightToHundredths(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed * 100));
}
