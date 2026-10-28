const HIGHLEVEL_ORIGIN = "https://services.leadconnectorhq.com";

export async function ghlGet(input: {
  fetchImpl: typeof fetch;
  token: string;
  path: string;
  query: Record<string, string>;
}): Promise<unknown> {
  const url = new URL(input.path, HIGHLEVEL_ORIGIN);
  for (const [key, value] of Object.entries(input.query)) url.searchParams.set(key, value);
  const response = await input.fetchImpl(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.token}`,
      Version: "v3",
    },
  });
  if (!response.ok) {
    await response.arrayBuffer();
    throw new Error(`HighLevel returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

export function calendarsFrom(payload: unknown): { id: string; name: string; timezone?: string }[] {
  if (!payload || typeof payload !== "object" || !("calendars" in payload) || !Array.isArray(payload.calendars)) {
    throw new Error("HighLevel calendar list was not usable.");
  }
  return payload.calendars.map((item) => {
    if (!item || typeof item !== "object") throw new Error("HighLevel calendar list was not usable.");
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const timezone = typeof record.timezone === "string"
      ? record.timezone
      : typeof record.timeZone === "string"
        ? record.timeZone
        : undefined;
    if (!id || !name) throw new Error("HighLevel calendar list was not usable.");
    return timezone ? { id, name, timezone } : { id, name };
  });
}

export function eventsFrom(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object" || !("events" in payload) || !Array.isArray(payload.events)) {
    throw new Error("HighLevel event list was not usable.");
  }
  return payload.events;
}
