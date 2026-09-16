const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a "YYYY-MM-DD" text field into an ISO timestamp, or null if empty/invalid. */
export function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!DATE_PATTERN.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Formats an ISO timestamp (or date string) back into "YYYY-MM-DD" for display in a text field. */
export function formatDateInput(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}
