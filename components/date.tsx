/** A visible date that matches the structured data exactly. */
export function DateText({ iso }: { iso: string }) {
  const text = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return <time dateTime={iso}>{text}</time>;
}
