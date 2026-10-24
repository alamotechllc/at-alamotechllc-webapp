import { createHash } from "node:crypto";
import { ulid } from "ulid";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function newId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}

export interface IdempotencyParts {
  tenantId: string;
  provider: string;
  providerEventId: string;
  upstreamProvider?: string | null;
  upstreamEventId?: string | null;
}

/** UTF-8 fields separated by newlines. Upstream ids win when both are present. */
export function idempotencyMaterial(parts: IdempotencyParts): string {
  const useUpstream = Boolean(parts.upstreamProvider && parts.upstreamEventId);
  const provider = useUpstream ? parts.upstreamProvider : parts.provider;
  const providerEventId = useUpstream ? parts.upstreamEventId : parts.providerEventId;
  return `${parts.tenantId}\n${provider}\n${providerEventId}`;
}

export function businessEventId(parts: IdempotencyParts): string {
  return `evt_${sha256Hex(idempotencyMaterial(parts))}`;
}

export function bindingIndexId(provider: string, externalAccountId: string): string {
  if (/^[A-Za-z0-9._~-]+$/.test(externalAccountId)) {
    return `${provider}__${externalAccountId}`;
  }
  return `${provider}__${sha256Hex(externalAccountId)}`;
}
