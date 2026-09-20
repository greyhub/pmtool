/**
 * <input type="date"> values ("YYYY-MM-DD") <-> ISO instants for the API.
 * Noon UTC, not local midnight: local midnight in UTC+7 is the previous day
 * in UTC, so a `.slice(0, 10)` round trip would drift a day earlier on every
 * edit. Noon UTC keeps the same calendar date in any timezone from UTC-12 to
 * UTC+11 (Vietnam included) and reads back unchanged.
 */
export function dateInputToIso(value: string): string {
  return `${value}T12:00:00.000Z`;
}

export function isoToDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Short local date for display, e.g. 20/09/2026. */
export function formatDate(iso: string | null | undefined, locale = 'vi-VN'): string {
  return iso ? new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' }) : '—';
}
