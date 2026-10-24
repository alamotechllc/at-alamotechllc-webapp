import { createHmac, timingSafeEqual } from "node:crypto";

export const PROVIDER_SIGNATURE_HEADER = "x-provider-signature";

/** Local authenticity check. Live GoHighLevel's signature scheme is not confirmed. */
export function signProviderBody(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyProviderSignature(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature || signature.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(signature)) return false;
  const expected = Buffer.from(signProviderBody(secret, rawBody), "hex");
  const presented = Buffer.from(signature, "hex");
  if (expected.length !== presented.length) return false;
  return timingSafeEqual(expected, presented);
}
