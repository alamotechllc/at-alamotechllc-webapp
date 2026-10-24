export function formatWhen(value: string | undefined): string {
  if (!value) return "Not configured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not configured";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(date);
}
