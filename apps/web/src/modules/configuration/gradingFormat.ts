/**
 * Display <-> hundredths helpers shared by the grading-policy builder and the
 * appreciation editor. Marks, thresholds and bounds travel the API as integer
 * hundredths (AGENTS.md §8); the UI edits them as decimal strings (comma or
 * period accepted, normalized once).
 */

export function parseDecimalToHundredths(value: string, scaleMax?: number): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return scaleMax !== undefined ? scaleMax * 100 : 0;
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
