# MVP API contract

**Status:** Specification for `/v1`. Not implemented.  
**Date:** 2026-10-23  
**Services:** `raas-api` (humans and scheduler), `raas-ingress` (adapters)

The public base URL is `https://alamotechllc.com/api/raas`, with `/v1` underneath, per [13-canonical-namespace-adr.md](./13-canonical-namespace-adr.md). Webhooks use `/api/webhooks/raas/{provider}`. A Cloud Run hostname is internal only. That public routing is not deployed: this site cannot proxy those prefixes yet. All JSON is UTF-8. Timestamps in requests are ISO-8601 UTC.

## Executive takeaway

Humans call `raas-api` with a Firebase ID token. Adapters call `raas-ingress` with a Google OIDC token. Both speak `/v1`. The marketing site has no endpoint in this version. Configuration writes, event ingest, results, and jobs are separate routes with separate callers.

---

## Versioning

- Path prefix `/v1` is the contract.
- Response header `X-RaaS-Api-Version: 1`.
- Additive fields and new optional query parameters are backward compatible.
- Removing a field, changing a metric meaning, or renaming an event type requires `/v2` and a `Sunset` header on `/v1` at least 90 days before removal.
- Event `schemaVersion` follows [08-business-event-contract.md](./08-business-event-contract.md).
- OpenAPI file in the future control-plane repo is `openapi/v1.yaml`. This markdown is the review copy until that repo exists.

## Authentication

| Caller | Header | Service |
| --- | --- | --- |
| Human | `Authorization: Bearer` Firebase ID token | `raas-api` |
| Scheduler | `Authorization: Bearer` Google OIDC token, email is the scheduler service account | `raas-api` `/internal/v1/*` |
| Adapter | `Authorization: Bearer` Google OIDC token, email is an allowlisted adapter | `raas-ingress` |

Missing or invalid credentials: `401 UNAUTHENTICATED`. Valid credentials with the wrong role: `403 PERMISSION_DENIED`.

Tenant scope for humans comes from the token plus the membership or assignment records. A `tenantId` in a query or body that disagrees with the caller’s scope is `403 TENANT_FORBIDDEN`. Platform admins may pass any tenant id. The request is audit-logged.

## Error model

Every error body:

```json
{
  "error": {
    "code": "TENANT_FORBIDDEN",
    "message": "You do not have access to this tenant.",
    "requestId": "req_01J...",
    "details": []
  }
}
```

`message` is safe to show in a UI. It contains no phone, email, secret, or other tenant’s id. `details` is a list of `{ "field": "attributes.phone", "issue": "invalid_e164" }` for validation. `requestId` is also the `X-Request-Id` response header. Clients may send `X-Request-Id`. The server generates one when the header is absent.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Malformed JSON or header |
| 401 | `UNAUTHENTICATED` | Missing or bad token |
| 403 | `PERMISSION_DENIED` | Role cannot call this route |
| 403 | `TENANT_FORBIDDEN` | Token cannot see this tenant |
| 404 | `NOT_FOUND` | Resource absent inside the caller’s tenant. Same code if it exists in another tenant |
| 404 | `BINDING_UNKNOWN` | Resolve endpoint, unknown or disabled binding |
| 409 | `IDEMPOTENCY_CONFLICT` | Same provider event, different canonical hash |
| 409 | `TENANT_SUSPENDED` | Ingest while suspended |
| 409 | `INSTANCE_NOT_ACTIVE` | Ingest while instance is not `active` |
| 409 | `APPOINTMENT_CONFLICT` | Illegal status move |
| 409 | `DUPLICATE_BINDING` | External account already active |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Configuration `Idempotency-Key` reused with a different body |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not `application/json` |
| 413 | `PAYLOAD_TOO_LARGE` | Inline receipt over 256 KiB |
| 422 | `UNKNOWN_EVENT_TYPE` | |
| 422 | `UNKNOWN_ATTRIBUTE` | |
| 422 | `CANONICAL_HASH_MISMATCH` | Adapter-supplied hash, if present, disagrees. Adapters omit the hash in the MVP and the server computes it |
| 422 | `TENANT_MISMATCH` | Body tenant does not match the binding |
| 422 | `LEAD_REQUIRED` | |
| 422 | `APPOINTMENT_UNKNOWN` | |
| 429 | `RATE_LIMITED` | |
| 500 | `INTERNAL` | Unexpected. No stack trace in the body |
| 503 | `UNAVAILABLE` | Dependency failed before commit. Safe to retry |

`details` on 500 is empty.

## Pagination

List routes accept `pageSize` (default 50, max 200) and `pageToken`. Response:

```json
{
  "items": [],
  "nextPageToken": null
}
```

Tokens are opaque. Clients do not parse them.

## `raas-api` routes

### Tenants and access

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| POST | `/v1/tenants` | `platform_admin` | Creates tenant. `Idempotency-Key` required |
| GET | `/v1/tenants` | `platform_admin`, `operator` | Operator sees assigned tenants only |
| GET | `/v1/tenants/{tenantId}` | reader of that tenant | |
| POST | `/v1/tenants/{tenantId}/members` | `platform_admin`, `tenant_admin` | Grants `tenant_admin` or `tenant_viewer` |
| POST | `/v1/operators/{uid}/assignments` | `platform_admin` | |

Tenant reader means `platform_admin`, an assigned `operator`, or a member with `tenant_admin` or `tenant_viewer`.

### Configuration

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/v1/tenants/{tenantId}/service-instances` | `platform_admin`, `operator` |
| GET | `/v1/tenants/{tenantId}/service-instances` | tenant reader |
| POST | `/v1/tenants/{tenantId}/service-instances/{instanceId}:activate` | `platform_admin`, `operator` |
| POST | `/v1/tenants/{tenantId}/campaigns` | `platform_admin`, `operator`, `tenant_admin` |
| GET | `/v1/tenants/{tenantId}/campaigns` | tenant reader |
| POST | `/v1/tenants/{tenantId}/provider-bindings` | `platform_admin`, `operator` |
| POST | `/v1/tenants/{tenantId}/provider-bindings/{bindingId}:disable` | `platform_admin`, `operator` |
| GET | `/v1/tenants/{tenantId}/provider-bindings` | `platform_admin`, `operator` |

Binding GET omits secret material and returns `secretResource` only to `platform_admin`. Operators see `secretPresent: true`. Tenant viewers do not have this route.

Creating a binding also creates the Secret Manager secret and the first version from a write-only field `secretValue` on the POST body. The API discards it after `secrets.addVersion`. It is not logged, not stored in Firestore, and not returned.

### Leads, appointments, events

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/v1/tenants/{tenantId}/leads` | tenant reader |
| GET | `/v1/tenants/{tenantId}/leads/{leadId}` | tenant reader |
| GET | `/v1/tenants/{tenantId}/leads/{leadId}/events` | tenant reader |
| POST | `/v1/tenants/{tenantId}/leads:merge` | `platform_admin`, `operator` |
| POST | `/v1/tenants/{tenantId}/leads/{leadId}:clear-escalation` | `platform_admin`, `operator`, `tenant_admin` |
| GET | `/v1/tenants/{tenantId}/appointments` | tenant reader |
| GET | `/v1/tenants/{tenantId}/events` | tenant reader |

Query filters for events: `serviceInstanceId`, `eventType`, `from`, `to`, `leadId`, `campaignId`, `correlationId`. `from` and `to` filter `occurredAt`.

Lead list filters: `serviceInstanceId`, `status`, `campaignId`.

Lead GET returns identity fields to every tenant reader. It does not return receipt bodies.

Merge body: `{ "winnerLeadId", "loserLeadId" }`. Audit action `lead.merge`.

### Results and receipts

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/v1/tenants/{tenantId}/results` | tenant reader |
| POST | `/v1/tenants/{tenantId}/results/snapshots` | `platform_admin`, `operator`, scheduler |
| GET | `/v1/tenants/{tenantId}/results/snapshots` | tenant reader |
| POST | `/v1/tenants/{tenantId}/receipts/{receiptId}:url` | `platform_admin`, `operator` |

Results query: `serviceInstanceId` (required), `from`, `to`. Response is the metric map from the event contract plus `metricPolicyVersion` and `generatedAt`. Tenant viewers may call GET results. They may not open receipt URLs in the MVP. Receipt access is an operator action and writes `receipt.read`.

### Audit and operations

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/v1/tenants/{tenantId}/audit-events` | `platform_admin`, `operator`, `tenant_admin` |
| GET | `/v1/tenants/{tenantId}/dead-letters` | `platform_admin`, `operator` |
| POST | `/v1/tenants/{tenantId}/dead-letters/{letterId}:discard` | `platform_admin`, `operator` |
| GET | `/v1/tenants/{tenantId}/reconciliation-items` | `platform_admin`, `operator` |
| POST | `/v1/tenants/{tenantId}/reconciliation-items/{itemId}:ignore` | `platform_admin`, `operator` |

Tenant admins see audit events for their tenant except `receipt.read` metadata that would reveal artifact paths. The list DTO for tenant admins omits `objectPath`.

### Internal jobs

Scheduler service account only. Not granted to Firebase users.

| Method | Path | Effect |
| --- | --- | --- |
| POST | `/internal/v1/jobs/result-snapshots` | For each active instance, persist the previous calendar day in the tenant timezone |
| POST | `/internal/v1/jobs/reconciliation` | For each binding with `reconcileMode=pull`, call the adapter and write the run |
| POST | `/internal/v1/jobs/retention` | Delete artifacts past `retentionUntil` |
| POST | `/internal/v1/jobs/dead-letter-age` | Mark untouched open letters older than 14 days with a log alert. Does not delete them |

Job body: `{ "tenantId": null }` means all tenants. A non-null `tenantId` limits the run. Each job writes one audit event per tenant it changes.

## `raas-ingress` routes

| Method | Path | Caller |
| --- | --- | --- |
| GET | `/v1/ingress/bindings:resolve` | Adapter SA |
| POST | `/v1/ingress/events` | Adapter SA |
| POST | `/v1/ingress/events:batch` | Adapter SA |
| POST | `/v1/ingress/receipt-uploads` | Adapter SA |
| POST | `/v1/ingress/dead-letters` | Adapter SA |

Batch body: `{ "events": [ ... ] }` with at most 20 items. Response:

```json
{
  "results": [
    { "index": 0, "status": 201, "eventId": "evt_...", "replayed": false },
    { "index": 1, "status": 422, "error": { "code": "UNKNOWN_ATTRIBUTE", "message": "Unknown attribute.", "requestId": "req_...", "details": [] } }
  ]
}
```

HTTP status of the batch is 200 when the batch was accepted and processed item by item, including item-level 422s. HTTP 401 if the caller is unauthorized. Each item uses its own transaction. There is no cross-item rollback.

`POST /v1/ingress/events` success:

```json
{
  "eventId": "evt_...",
  "leadId": "led_...",
  "replayed": false,
  "receiptId": "rcp_..."
}
```

## Rate limits

| Route group | Limit |
| --- | --- |
| Ingress per adapter SA | 50 requests per second, burst 100 |
| Results GET per user | 10 per minute per tenant |
| Receipt URL | 30 per hour per operator |
| Configuration POST | 30 per minute per user |

Exceeded: `429 RATE_LIMITED` and `Retry-After`.

## Deferred route

`POST /v1/public/leads` on a future `raas-public` service is not in the MVP. When it is added it accepts only the Alamo Tech tenant, uses a server-side allowlist, rate limits by IP, and creates `LeadCaptured` through the same ingest function. It never accepts a client-chosen `tenantId`. It is documented here so the marketing site does not invent a private Firestore write later.

## Correlation

Logs, errors, and audit events share `requestId`. Ingress responses include `eventId` so an adapter log line can be joined to the business event without logging PII.
