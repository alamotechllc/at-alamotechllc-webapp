# Control plane domain model

**Status:** MVP specification. Not implemented.  
**Date:** 2026-10-23  
**Database target:** New Cloud Firestore Enterprise database. Not created in this task.

Operational documents live under a tenant path. Lookup documents exist only so an adapter can resolve `provider + externalAccountId` to a tenant before any tenant write. Clients never receive the Firestore SDK. Every path below is Admin SDK only. Security rules deny all client access; see [11-mvp-security-model.md](./11-mvp-security-model.md).

## Executive takeaway

Every operational record hangs off `tenants/{tenantId}` except three global indexes the server uses to find that tenant. Leads, events, and results are projections of business events plus a small set of configuration documents. Provider names appear on bindings and on the event `source` object. They do not appear in collection names.

---

## Identity and ID rules

| ID | Format | Uniqueness |
| --- | --- | --- |
| `tenantId` | `ten_` + ULID | Document ID |
| `instanceId` | `ins_` + ULID | Document ID under the tenant |
| `campaignId` | `cmp_` + ULID | Document ID under the tenant |
| `bindingId` | `bnd_` + ULID | Document ID under the tenant |
| `leadId` | `led_` + ULID | Document ID under the tenant |
| `appointmentId` | `apt_` + ULID | Document ID under the tenant |
| `eventId` | `evt_` + hex SHA-256 of the idempotency material | One document per provider event |
| `receiptId` | `rcp_` + ULID | Pointer to Cloud Storage |
| `uid` | Firebase Auth uid | `users/{uid}` |

ULIDs are lowercase Crockford base32. Document IDs do not contain `/`.

Idempotency material, UTF-8, fields separated by `\n`:

```text
tenantId
provider
providerEventId
```

`eventId = "evt_" + sha256(material).hex`. A replay of the same provider event in the same tenant is the same document.

Timestamps are Firestore timestamps in UTC. Money is an integer in minor units plus an ISO-4217 `currency`. Phone numbers are E.164. Emails are trimmed, lowercased, and NFKC-normalized.

## Collection map

```text
raasProducts/{productCode}

users/{uid}
operators/{uid}
operators/{uid}/assignments/{tenantId}

tenants/{tenantId}
tenants/{tenantId}/members/{uid}
tenants/{tenantId}/serviceInstances/{instanceId}
tenants/{tenantId}/campaigns/{campaignId}
tenants/{tenantId}/providerBindings/{bindingId}
tenants/{tenantId}/leads/{leadId}
tenants/{tenantId}/leads/{leadId}/qualification/current
tenants/{tenantId}/appointments/{appointmentId}
tenants/{tenantId}/businessEvents/{eventId}
tenants/{tenantId}/resultSnapshots/{snapshotId}
tenants/{tenantId}/auditEvents/{auditId}
tenants/{tenantId}/providerReceipts/{receiptId}
tenants/{tenantId}/deadLetters/{letterId}
tenants/{tenantId}/reconciliationRuns/{runId}
tenants/{tenantId}/reconciliationItems/{itemId}

providerBindingIndex/{provider}__{externalAccountId}
leadIdentityIndex/{tenantId}__{kind}__{valueHash}
appointmentIndex/{tenantId}__{provider}__{providerAppointmentId}
```

`qualification/current` is a single document, not a history. History is the business events.

Global index documents store `tenantId` and the target ID. They are written in the same transaction as the tenant document they point at. They are not a second source of truth for the business fields.

## Product catalog

`raasProducts/lead-capture`

| Field | Required | Notes |
| --- | --- | --- |
| `code` | yes | `lead-capture`. Immutable |
| `name` | yes | Lead Capture RaaS |
| `outcome` | yes | Capture, qualify, follow up with, and book inbound opportunities that a client might otherwise lose |
| `status` | yes | `active` for this product only |
| `metricPolicyVersion` | yes | `lead-capture-metrics-v1` |
| `eventTypes` | yes | The closed list in [08-business-event-contract.md](./08-business-event-contract.md) |

No other product document is created for the MVP.

## Tenant

`tenants/{tenantId}`

| Field | Required | Notes |
| --- | --- | --- |
| `tenantId` | yes | Matches the path. Immutable |
| `legalName` | yes | The RaaS client, which may be Alamo Tech itself for tenant zero |
| `status` | yes | `pending`, `active`, `suspended`, `closed` |
| `createdAt` | yes | |
| `createdByUid` | yes | |
| `timezone` | yes | IANA name. Default `America/Chicago` when the client is unspecified |
| `retention` | yes | Overrides in [11-mvp-security-model.md](./11-mvp-security-model.md). Stored so a contract change is explicit |

Suspended tenants reject new events with `409 TENANT_SUSPENDED`. Existing documents stay readable to operators.

## Members and operators

`tenants/{tenantId}/members/{uid}`

| Field | Required | Notes |
| --- | --- | --- |
| `uid` | yes | Immutable |
| `role` | yes | `tenant_admin` or `tenant_viewer` |
| `status` | yes | `invited`, `active`, `revoked` |
| `email` | yes | Display and invite. Not an authorization key |

`operators/{uid}`

| Field | Required | Notes |
| --- | --- | --- |
| `platformRole` | yes | `platform_admin` or `operator` |
| `status` | yes | `active` or `revoked` |
| `hostedDomain` | yes | Must match the configured operator domain |

`operators/{uid}/assignments/{tenantId}` exists only for `operator`. A `platform_admin` does not need a row per tenant. Assignment fields: `tenantId`, `grantedByUid`, `grantedAt`.

Firebase Auth custom claims are a cache of this model, not the source of truth. Claim contents and size limits are in the security model.

## Service instance

`tenants/{tenantId}/serviceInstances/{instanceId}`

One active Lead Capture instance per tenant in the MVP. The API rejects a second `active` instance for `lead-capture`.

| Field | Required | Notes |
| --- | --- | --- |
| `instanceId` | yes | Immutable |
| `tenantId` | yes | Immutable. Must match the path |
| `productCode` | yes | `lead-capture` |
| `status` | yes | `draft`, `active`, `paused`, `ended` |
| `metricPolicyVersion` | yes | Copied from the product at creation. Changes are versioned, not overwritten in past snapshots |
| `metricPolicy` | yes | Windows used by result math. See below |
| `activatedAt` | no | Set when status becomes `active` |
| `endedAt` | no | |

`metricPolicy` for `lead-capture-metrics-v1`:

| Key | Default | Meaning |
| --- | --- | --- |
| `recoveryWindowHours` | 24 | A missed call is recovered when `MissedCallRecovered` arrives inside this window |
| `businessHours` | Mon–Fri 09:00–17:00 in the tenant timezone | Used only for the business-hours response-time figure |
| `valueBasis` | `estimate` | `OpportunityValued` amounts are estimates |

Events are accepted only when instance status is `active`.

## Campaign attribution

`tenants/{tenantId}/campaigns/{campaignId}`

| Field | Required | Notes |
| --- | --- | --- |
| `campaignId` | yes | |
| `tenantId` | yes | |
| `serviceInstanceId` | yes | |
| `name` | yes | Human label |
| `code` | yes | Stable slug, unique per tenant. Used in links and spoken tracking numbers’ labels |
| `channel` | yes | `call`, `sms`, `email`, `form`, `calendar`, `manual`, `other` |
| `status` | yes | `active` or `archived` |
| `startAt` / `endAt` | no | |

Resolution order when an event is ingested. First match wins. The chosen id is stored on the event. The resolver does not invent a campaign.

1. `campaignId` on the ingress body, if it belongs to the same tenant and instance.
2. `providerBindings.defaultCampaignId`, if set.
3. A routing key on the binding: `routes[]` of `{ kind, value, campaignId }` where `kind` is `phone`, `form`, `email_address`, or `calendar`. Match the destination phone, form, inbox, or calendar that received the activity.
4. Otherwise `campaignId` is null and `attribution` is `unknown`.

`attribution` on the event is `explicit`, `binding_default`, `route`, or `unknown`. Reports can filter unknowns. They do not drop those events.

Campaign codes are unique per tenant by document `campaignCodes/{code}` under the tenant, written in the same transaction, pointing at `campaignId`.

## Provider binding

`tenants/{tenantId}/providerBindings/{bindingId}`

| Field | Required | Notes |
| --- | --- | --- |
| `bindingId` | yes | |
| `tenantId` | yes | Immutable |
| `serviceInstanceId` | yes | Immutable after create |
| `channel` | yes | `voice`, `sms`, `email`, `calendar`, `form`, `automation` |
| `provider` | yes | Stable slug such as `gohighlevel`. Data only |
| `externalAccountId` | yes | Location, subaccount, or phone-number account at the provider. Immutable |
| `secretResource` | yes | Full Secret Manager resource name. The secret value is never stored here |
| `defaultCampaignId` | no | |
| `routes` | no | Attribution routes above |
| `status` | yes | `active` or `disabled` |
| `createdAt` | yes | |

Global index, document ID `{provider}__{externalAccountId}` after the external id is restricted to `[A-Za-z0-9._~-]`. If the raw id contains other characters, the document ID is `{provider}__{sha256(externalAccountId)}` and the document stores the raw id.

Index fields: `provider`, `externalAccountId`, `tenantId`, `bindingId`, `serviceInstanceId`, `status`.

The API rejects a second active binding for the same `provider` and `externalAccountId`. Disabled bindings remain so old receipts still resolve for audit. A new tenant cannot claim an external account that another tenant still has in `active` status.

`automation` is the channel for an n8n (or similar) hop. The binding’s `provider` may be `n8n`, and the business event still uses a catalog type. The upstream provider’s account id, when n8n is only glue, is stored as `source.upstreamProvider` and `source.upstreamAccountId` on the event. Idempotency uses the upstream provider and upstream event id when those fields are present, so an n8n retry and a direct adapter retry collapse to one event.

## Lead and deduplication

`tenants/{tenantId}/leads/{leadId}`

| Field | Required | Notes |
| --- | --- | --- |
| `leadId` | yes | |
| `tenantId` | yes | |
| `serviceInstanceId` | yes | |
| `status` | yes | `open`, `qualified`, `disqualified` |
| `displayName` | no | |
| `organization` | no | |
| `emails` | yes | Array, possibly empty. Normalized |
| `phones` | yes | Array of E.164, possibly empty |
| `campaignId` | no | From the capture event. Not overwritten by later events |
| `estimatedValue` | no | `{ amountMinor, currency, basis }` from the latest `OpportunityValued` |
| `escalationOpen` | yes | Boolean. Set by `HumanEscalationRequested`. Cleared only by an operator audit action in the MVP |
| `possibleDuplicateOf` | no | `leadId` when automatic merge was refused |
| `mergedInto` | no | Set when an operator merges this lead away. Status stays, and new events retarget |
| `createdAt` | yes | `occurredAt` of the creating event |
| `updatedAt` | yes | |

`tenants/{tenantId}/leads/{leadId}/qualification/current`

| Field | Required | Notes |
| --- | --- | --- |
| `state` | yes | `unknown`, `qualified`, `disqualified` |
| `reasonCode` | no | From the latest qualification event |
| `actor` | yes | `automation`, `human`, or `none` |
| `eventId` | no | Event that produced this state |
| `occurredAt` | no | |

Identity index `leadIdentityIndex/{tenantId}__{kind}__{valueHash}`:

| `kind` | Normalized value |
| --- | --- |
| `phone` | E.164 |
| `email` | Normalized email |
| `external` | `provider + ":" + externalContactId` |

Document fields: `tenantId`, `leadId`, `kind`, `valueHash`. The raw phone or email is not copied into the index. The lead document holds the raw normalized value.

Match algorithm inside the ingest transaction:

1. If the body includes a `leadId` in this tenant that is not `mergedInto`, use it.
2. Else if `external` key hits, use that lead.
3. Else if `phone` hits, use that lead.
4. Else if `email` hits, use that lead.
5. Else create a lead when the event type is allowed to create one: `LeadCaptured`, `InboundCallReceived`, `SmsMessageReceived`, `EmailMessageReceived`, `AppointmentBooked`.
6. Else store the event with `leadId` null and open a reconciliation item `unlinked_event`.

Conflict rule: if phone hits lead A and email hits lead B, attach the event to the phone match for call and SMS events, and to the email match for email events. Set `possibleDuplicateOf` on the newer lead. Do not auto-merge. An operator merge is an audit action that sets `mergedInto` and repoints identity index rows in one transaction. Merge is not a new business event. Adding one would change the approved catalog.

Creating events that carry neither phone, email, nor external id still create a lead for `LeadCaptured` and `AppointmentBooked` so the opportunity is not dropped. Call and message events without a counterparty do not create a lead.

## Appointment

`tenants/{tenantId}/appointments/{appointmentId}`

| Field | Required | Notes |
| --- | --- | --- |
| `appointmentId` | yes | Control-plane id |
| `tenantId` | yes | |
| `serviceInstanceId` | yes | |
| `leadId` | no | |
| `campaignId` | no | |
| `status` | yes | `booked`, `attended`, `no_show`, `cancelled` |
| `startAt` / `endAt` | yes for booked | |
| `timezone` | yes | |
| `provider` | yes | From `source`, for reconciliation |
| `providerAppointmentId` | yes | |
| `bookedEventId` | yes | |
| `attendanceEventId` | no | |

Index `appointmentIndex/{tenantId}__{provider}__{providerAppointmentId}` points at `appointmentId`.

`AppointmentBooked` creates or returns the existing appointment. `AppointmentAttended` and `AppointmentNoShow` update status and refuse to move a terminal status backward (`attended` to `no_show` returns `409 APPOINTMENT_CONFLICT` unless an operator records an audit correction and a new event is not required). Cancellation is out of the approved event list. A provider cancellation becomes a reconciliation item `appointment_cancelled_unmodeled` until a catalog change is approved. The appointment stays `booked`.

## Business event

`tenants/{tenantId}/businessEvents/{eventId}`

The field contract is [08-business-event-contract.md](./08-business-event-contract.md). Documents are immutable. Corrections are new events or audit records, not updates. Firestore rules and the API both refuse updates and deletes of this collection in the MVP. Admin scripts that must delete for retention run as a named job and write an audit event first.

## Result snapshot

`tenants/{tenantId}/resultSnapshots/{snapshotId}`

Computed by the job in the API contract. Not edited in place. A rerun writes a new snapshot.

| Field | Required | Notes |
| --- | --- | --- |
| `snapshotId` | yes | `snp_` + ULID |
| `tenantId` | yes | |
| `serviceInstanceId` | yes | |
| `metricPolicyVersion` | yes | |
| `periodStart` / `periodEnd` | yes | Half-open interval `[start, end)` |
| `generatedAt` | yes | |
| `eventCount` | yes | Events read |
| `metrics` | yes | Map of metric key to `{ value, unit, notes }` |
| `unknownCampaignEvents` | yes | Count |
| `generator` | yes | `lead-capture-metrics-v1` |

On-demand `GET /v1/results` uses the same function and does not persist unless `persist=true` and the caller is an operator or the scheduler.

Metric keys and formulas are in the event contract’s result section so the math and the events stay together.

## Audit event

`tenants/{tenantId}/auditEvents/{auditId}`

Separate stream from business events. A metric backfill must not be able to hide an access.

| Field | Required | Notes |
| --- | --- | --- |
| `auditId` | yes | `aud_` + ULID |
| `tenantId` | yes | `platform` is not used. Platform actions that touch a tenant name that tenant. Platform actions that touch no tenant use `operators` audit under `operators/{uid}/auditEvents/{auditId}` |
| `actorUid` | yes | Or `actorSa` for a service account |
| `actorRole` | yes | Role at the time of the call |
| `action` | yes | Dot names: `tenant.create`, `binding.create`, `binding.disable`, `member.grant`, `member.revoke`, `lead.merge`, `lead.escalation_clear`, `receipt.read`, `result.export`, `event.replay`, `retention.purge`, `reconciliation.resolve` |
| `target` | yes | `{ type, id }` |
| `occurredAt` | yes | |
| `requestId` | yes | |
| `metadata` | no | No message bodies, secrets, or raw provider JSON |

Audit documents are append-only.

## Provider receipt

`tenants/{tenantId}/providerReceipts/{receiptId}`

Metadata only. The body is a Cloud Storage object.

| Field | Required | Notes |
| --- | --- | --- |
| `receiptId` | yes | |
| `tenantId` | yes | |
| `eventId` | no | Set when an event was produced. Schema failures may have a receipt and a dead letter and no event |
| `provider` | yes | |
| `sha256` | yes | Of the stored bytes |
| `bytes` | yes | |
| `contentType` | yes | |
| `objectPath` | yes | `tenants/{tenantId}/providers/{provider}/{yyyy}/{mm}/{dd}/{receiptId}` |
| `retentionUntil` | yes | From the instance retention policy |
| `createdAt` | yes | |

Object contents are the verified provider payload. Call audio and attachments use a sibling prefix `recordings/` and `attachments/` with a shorter retention. The receipt document points at them with `artifactPaths[]`. The API that returns a signed URL writes `receipt.read` audit and the URL expires in 5 minutes.

## Dead letter

`tenants/{tenantId}/deadLetters/{letterId}`

When the tenant is not yet known, the letter is stored at `deadLetters/{letterId}` with `tenantId: null`. That root collection is still Admin SDK only.

| Field | Required | Notes |
| --- | --- | --- |
| `letterId` | yes | |
| `tenantId` | no | |
| `source` | yes | `ingress`, `projection`, `reconciliation`, `retention` |
| `reasonCode` | yes | Stable string from the error catalog |
| `attempts` | yes | |
| `status` | yes | `open`, `replayed`, `discarded` |
| `firstSeenAt` / `lastSeenAt` | yes | |
| `requestId` | yes | |
| `receiptId` | no | |
| `summary` | yes | One line, no PII |

## Reconciliation

`reconciliationRuns/{runId}` records `bindingId`, window, startedAt, finishedAt, comparedCounts.

`reconciliationItems/{itemId}` records `kind` (`missing_in_control_plane`, `missing_in_provider`, `count_mismatch`, `unlinked_event`, `appointment_cancelled_unmodeled`), `status` (`open`, `resolved`, `ignored`), and `notes` without raw payloads.

Resolving `missing_in_control_plane` re-drives ingress with the original provider event id. It does not insert a business event through a side door.

## Indexes

Enterprise does not build indexes automatically. Declare at least:

| Collection | Fields | Use |
| --- | --- | --- |
| `businessEvents` | `serviceInstanceId` ASC, `occurredAt` ASC | Result windows |
| `businessEvents` | `serviceInstanceId` ASC, `eventType` ASC, `occurredAt` ASC | One metric |
| `businessEvents` | `leadId` ASC, `occurredAt` ASC | Lead timeline |
| `businessEvents` | `correlationId` ASC, `occurredAt` ASC | Episode |
| `leads` | `serviceInstanceId` ASC, `status` ASC, `updatedAt` DESC | Lead list |
| `appointments` | `serviceInstanceId` ASC, `startAt` ASC | Schedule window |
| `deadLetters` | `status` ASC, `lastSeenAt` DESC | Operator queue |
| `auditEvents` | `occurredAt` DESC | Audit list |
| `reconciliationItems` | `status` ASC, `kind` ASC | Open breaks |

Unique indexes, Enterprise only, as a second guard behind deterministic IDs:

| Collection | Fields |
| --- | --- |
| `providerBindingIndex` | `provider`, `externalAccountId` |
| `leadIdentityIndex` | `tenantId`, `kind`, `valueHash` |
| `appointmentIndex` | `tenantId`, `provider`, `providerAppointmentId` |

Collection-group queries are not used by the MVP API. Operators loop tenants or call the API with a tenant id. That keeps a missing `tenantId` filter from becoming a cross-tenant read.

## Relationships

```text
raasProducts 1 ── * serviceInstances
tenant 1 ── * serviceInstances
tenant 1 ── * campaigns
serviceInstance 1 ── * providerBindings
serviceInstance 1 ── * leads
serviceInstance 1 ── * appointments
serviceInstance 1 ── * businessEvents
lead 1 ── 1 qualification/current
lead 1 ── * appointments
businessEvent * ── 0..1 lead
businessEvent * ── 0..1 campaign
businessEvent 0..1 ── 1 providerReceipt
providerBinding * ── 1 secret (Secret Manager, by reference)
```

A lead belongs to one service instance. Cross-instance identity matching is out of scope for the MVP.
