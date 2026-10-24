# Provider adapter contract

**Status:** MVP specification. Not implemented.  
**Date:** 2026-10-23

Adapters translate a provider webhook or poll into the business-event envelope. They are the only place that knows a vendor’s JSON. The control plane ingress knows bindings, idempotency, and the catalog.

## Executive takeaway

An adapter verifies the vendor, maps one vendor notification to one catalog event, and calls ingress with its service account. GoHighLevel, a voice API, SMS, email, a calendar, and n8n all use this same contract. None of them add an event type.

---

## Place in the system

```text
Provider  --signed webhook-->  Adapter (Cloud Run, internal)
Adapter   --OIDC + JSON------>  raas-ingress
raas-ingress --Admin SDK------>  Firestore + Cloud Storage metadata
```

The provider webhook URL is the adapter’s URL, not an n8n URL published in the marketing site, and not `raas-ingress`. Ingress has no `allUsers` invoker.

n8n may be the adapter process for a transition period. It still calls ingress with a service account and still emits catalog events. A workflow that writes straight to Firestore violates this contract.

## Adapter identity

Each adapter deployment has a Google service account, for example `raas-adapter-gohighlevel@PROJECT.iam.gserviceaccount.com`.

Cloud Run IAM grants that account `run.invoker` on `raas-ingress` only. The token audience is the ingress service URL. Ingress rejects any other audience, any user Firebase token, and any service account that is not on the adapter allowlist.

MVP allowlist (configuration, not a business collection):

| Service account purpose | May send events for `source.provider` |
| --- | --- |
| `raas-adapter-gohighlevel` | `gohighlevel` |
| `raas-adapter-voice` | the voice slug chosen at build time |
| `raas-adapter-messaging` | the SMS or email slug |
| `raas-adapter-calendar` | the calendar slug, if it is not GoHighLevel |
| `raas-adapter-n8n` | `n8n`, and must set `upstreamProvider` |

One account per adapter type is the MVP. Tenant isolation is the binding lookup, not a separate service account per client. A stolen adapter identity can submit events only for external accounts that have an active binding, and only after it can obtain the provider signing secret for that account. Secrets are per binding, so a stolen identity without the signing secret cannot forge a webhook. It can replay an event it already saw. Idempotency makes replay a no-op.

Per-tenant adapter accounts are a later hardening step, not an MVP requirement.

## What the adapter must do

1. Read the raw body once. Verification is over the exact bytes.
2. Identify the external account from the vendor payload or the URL path (`/webhooks/gohighlevel/{externalAccountId}`).
3. Load the signing secret from Secret Manager using the binding’s `secretResource`. The adapter resolves the binding by calling `GET /v1/ingress/bindings:resolve` (below) or by reading a cache filled from that endpoint. It does not query Firestore.
4. Verify the vendor signature. Failure returns 401 to the vendor and does not call ingress.
5. Map to zero or one business event. Zero is a successful ignore: return 200 to the vendor, do not call ingress. Examples: a provider heartbeat, a test ping, a contact update that changes no catalog fact.
6. Upload nothing to the receipts bucket itself. Ingress writes the receipt so a buggy adapter cannot choose another tenant’s object prefix. The adapter sends the raw body base64 in `receipt.inlineBase64` when the body is ≤ 256 KiB. Larger artifacts (audio) use a separate upload session issued by ingress.
7. POST `/v1/ingress/events`.
8. Acknowledge the vendor only after ingress returns 201 or 200. On 503 or 500, return 500 to the vendor so the vendor retries. On 422 or 409, return 200 to the vendor after logging a dead letter, so a poison payload does not retry forever. 409 `IDEMPOTENCY_CONFLICT` is a poison payload, not a success replay. Success replay is HTTP 200 with `replayed: true`.

## Ingress request

`POST /v1/ingress/events`

```json
{
  "schemaVersion": 1,
  "eventType": "AppointmentBooked",
  "occurredAt": "2026-10-23T15:04:05.000Z",
  "occurredAtSource": "provider",
  "correlationId": "call_123",
  "campaignId": null,
  "leadId": null,
  "source": {
    "provider": "gohighlevel",
    "providerEventId": "appt_987",
    "providerAccountId": "loc_abc",
    "upstreamProvider": null,
    "upstreamEventId": null
  },
  "attributes": {},
  "receipt": {
    "contentType": "application/json",
    "inlineBase64": ""
  }
}
```

The adapter does not send `tenantId`, `serviceInstanceId`, `bindingId`, `eventId`, or `canonicalHash`. Ingress fills those. An adapter that sends `tenantId` must match the binding or the call fails with `422 TENANT_MISMATCH`. The safe adapter omits it.

### Resolve binding

`GET /v1/ingress/bindings:resolve?provider=gohighlevel&externalAccountId=loc_abc`

Response is limited to what the adapter needs to verify a signature and attribute a route:

```json
{
  "bindingId": "bnd_...",
  "tenantId": "ten_...",
  "serviceInstanceId": "ins_...",
  "status": "active",
  "secretResource": "projects/PROJECT/secrets/raas-prod-binding-bnd_.../versions/latest",
  "defaultCampaignId": null,
  "routes": []
}
```

Disabled or unknown bindings return `404 BINDING_UNKNOWN` with an identical body shape and no indication whether the account exists in another status. The adapter answers the vendor with 401.

This endpoint is on `raas-ingress` and uses the same service-account check. It is not on `raas-api`.

## Mapping rules

| Provider fact | Catalog event | Notes |
| --- | --- | --- |
| Form submitted, or a new person created from an inbound channel | `LeadCaptured` | `captureChannel` set from the channel, not from the vendor name |
| Inbound call started or logged | `InboundCallReceived` | |
| Call bridged or answered | `InboundCallAnswered` | |
| Call ended unanswered | `InboundCallMissed` | |
| Later live answer or booked slot tied to that missed `callId` inside the recovery window | `MissedCallRecovered` | The adapter emits the event when the provider says recovery happened. The metric function also checks the window, so an adapter that emits late does not inflate `callsRecovered` |
| SMS in or out | `SmsMessageReceived` or `SmsMessageSent` | |
| Email in or out | `EmailMessageReceived` or `EmailMessageSent` | |
| Sequence step or staff attempt | `FollowUpAttempted` | |
| Qualification flag or pipeline stage that the binding’s stage map names as qualified | `LeadQualified` | Stage names live in adapter config, not in the core schema |
| Stage map names disqualified | `LeadDisqualified` | |
| Handoff to a human | `HumanEscalationRequested` | |
| Calendar booking created | `AppointmentBooked` | |
| Attendance marked | `AppointmentAttended` or `AppointmentNoShow` | |
| Monetary value on the person or deal | `OpportunityValued` | `basis` is `estimate` unless a future contract says otherwise |

Stage-map config is adapter configuration in Secret Manager or a non-PII config object on the binding: `stageMap: { "qualifiedStageIds": [], "disqualifiedStageIds": [] }`. Those ids are provider ids. They are not business event names.

If the vendor sends one webhook that contains both a new contact and a booking, the adapter sends two ingress calls, in order, with distinct `providerEventId`s (suffix the vendor id with `#lead` and `#appointment` only when the vendor does not provide two ids). Each call is idempotent.

## Receipt handling

| Artifact | Where it is stored | Who writes it |
| --- | --- | --- |
| Webhook JSON ≤ 256 KiB | `gs://raas-receipts-ENV/tenants/{tenantId}/providers/{provider}/yyyy/mm/dd/{receiptId}` | Ingress, before the Firestore transaction |
| Audio and large files | `.../recordings/{receiptId}` | Ingress upload session. Adapter PUTs to a signed URL that is already prefixed with the tenant |
| Firestore | `providerReceipts` metadata | Ingress |

The signed upload URL is issued by `POST /v1/ingress/receipt-uploads` and constrained to that tenant prefix. TTL 15 minutes. The event request then references `receipt.uploadId` instead of `inlineBase64`.

Retention is applied with a bucket lifecycle rule and checked by the weekly retention job. The job deletes the object and the metadata document only after `retentionUntil`, and it writes `retention.purge`.

Adapters do not log the raw body. They log `provider`, `providerEventId`, `bindingId`, and the ingress status code.

## Secret Manager

| Secret ID | Contents | Readers |
| --- | --- | --- |
| `raas-{env}-binding-{bindingId}` | Provider signing secret and any API token that adapter needs for that account | The adapter service account for that provider, and `raas-ingress` if ingress must re-verify |

`raas-api` can create and add versions. It cannot read payload versions (`roles/secretmanager.secretVersionAdder` and resource admin, without `secretAccessor`). Operators retrieve secrets with `gcloud` break-glass, which is audited by Cloud Audit Logs.

Rotation: add a version, update the binding document’s `secretResource` to the new version, disable the old version after the adapter cache TTL (5 minutes).

The marketing site’s GitHub secrets and `VITE_` variables are not in this scheme.

## Dead-letter behavior

| Ingress result | Adapter action | Dead letter |
| --- | --- | --- |
| 201, or 200 `replayed: true` | Ack the vendor | No |
| 422 | Ack the vendor so it stops. Operator fixes the mapper | Yes, written by ingress |
| 409 `IDEMPOTENCY_CONFLICT` | Ack the vendor | Yes |
| 401 or 403 | Do not ack as success. Fix identity | No receipt of a business event |
| 404 `BINDING_UNKNOWN` | 401 to the vendor | Root dead letter if the account id was well formed and the signature was valid, so an unknown location is visible |
| 503 or 500 | 500 to the vendor | No, until the adapter exhausts its local retries |

Adapter local retries: 5 attempts, exponential backoff from 1 second, cap 30 seconds, jitter. After exhaustion, the adapter writes nothing itself. The vendor’s retry, or a morning reconciliation, brings the event back. If the provider will not retry, the adapter POSTs `POST /v1/ingress/dead-letters` with the receipt inline and `reasonCode=UPSTREAM_GAVE_UP`. That route only stores a dead letter. It does not create a business event.

## Reconciliation support

Each adapter implements a pull the daily job can call:

`POST /internal/adapter/{provider}/reconcile`

Scheduler calls the adapter with OIDC. The adapter reads the provider’s appointments or calls for the window and submits any missing facts through the same ingress path. It returns counts `{ seen, submitted, replayed }` to the job. The job writes `reconciliationRuns` and items. Adapters that cannot pull (no list API) are marked `reconcileMode: webhook_only` on the binding. Those bindings produce a run with `comparedCounts: null` and a note, not a false green.

GoHighLevel is expected to support a pull of calendar appointments for the first reconciliation. Voice reconciliation waits until that provider is chosen. The contract requires the pull method. The MVP may ship the GoHighLevel calendar pull first and `webhook_only` for the others, as long as the binding records that mode.

## Forbidden

- Importing this adapter into `at-alamotechllc-website`.
- Naming an event `GhlAppointmentBooked`, `TwilioSmsReceived`, or similar.
- Passing provider secrets to the browser.
- Writing Firestore from the adapter.
- Treating an n8n execution id as the only idempotency key when an upstream provider event id exists.
