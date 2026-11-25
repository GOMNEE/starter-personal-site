/**
 * A visible date that matches the structured data: `iso` is a date
 * (YYYY-MM-DD) or a date-time, shown as its UTC calendar date.
 */
export function DateText({ iso }: { iso: string }) {
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  const text = date.toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return <time dateTime={iso}>{text}</time>;
}

/** The calendar day (UTC) of an ISO date or date-time. */
export const dayOf = (iso: string) => iso.slice(0, 10);
