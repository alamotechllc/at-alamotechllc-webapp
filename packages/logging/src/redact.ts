const DENY = new Set([
  "authorization",
  "cookie",
  "secretvalue",
  "inlinebase64",
  "email",
  "phone",
  "fromphone",
  "tophone",
  "fromemail",
  "toemail",
  "givenname",
  "familyname",
  "displayname",
  "organization",
  "name",
  "firstname",
  "lastname",
  "contact",
  "attendee",
  "body",
  "subject",
  "raw",
  "payload",
  "providerpayload",
  "rawbody",
  "webhookbody",
  "messagebody",
  "recording",
  "recordingurl",
  "signedurl",
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (DENY.has(key.toLowerCase())) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = redact(item);
  }
  return output;
}
