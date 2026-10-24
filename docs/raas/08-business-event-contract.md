# Business event contract

**Status:** MVP specification. Catalog approved 2026-10-23.  
**Schema version:** `1`  
**Date:** 2026-10-23

Business events name what happened for the client. The provider that reported the fact is stored in `source`. Provider product names are forbidden in `eventType`.

## Executive takeaway

Ingress accepts one closed set of Lead Capture events. The same provider event replays onto the same Firestore document. Results are pure functions of those events plus the service instance’s metric policy. Raw vendor JSON is not a field on the event.

---

## Envelope

Stored at `tenants/{tenantId}/businessEvents/{eventId}`.

| Field | Type | Required | Mutable |
| --- | --- | --- | --- |
| `schemaVersion` | number | yes | no. MVP value `1` |
| `eventId` | string | yes | Document ID |
| `eventType` | string | yes | Closed catalog |
| `occurredAt` | timestamp | yes | Provider time when the adapter marks it trusted. Otherwise adapter receive time, and `occurredAtSource` is `adapter_received` |
| `occurredAtSource` | string | yes | `provider` or `adapter_received` |
| `recordedAt` | timestamp | yes | Server clock at commit |
| `tenantId` | string | yes | From the binding. A disagreeing body value is `422 TENANT_MISMATCH` |
| `serviceInstanceId` | string | yes | From the binding |
| `campaignId` | string or null | yes | Null allowed. See attribution |
| `attribution` | string | yes | `explicit`, `binding_default`, `route`, `unknown` |
| `leadId` | string or null | yes | |
| `correlationId` | string | yes | Episode key. Adapter-supplied, else the provider call, conversation, or appointment id |
| `source` | object | yes | See below |
| `attributes` | object | yes | Type-specific. No free-form dump |
| `canonicalHash` | string | yes | SHA-256 of the canonical JSON used for conflict detection |
| `receiptId` | string or null | yes | |

`source`:

| Field | Required | Notes |
| --- | --- | --- |
| `provider` | yes | Slug. Not part of `eventType` |
| `providerEventId` | yes | Vendor’s id for this fact. Idempotency input |
| `providerAccountId` | yes | Must match the binding’s `externalAccountId` |
| `bindingId` | yes | |
| `upstreamProvider` | no | Set when `provider` is glue such as `n8n` |
| `upstreamEventId` | no | When set, idempotency uses this instead of `providerEventId`, and `provider` in the hash is `upstreamProvider` |

### Canonical hash

JSON with sorted object keys, no insignificant whitespace. Include `schemaVersion`, `eventType`, `occurredAt` (UTC ISO-8601 with milliseconds), `tenantId`, `serviceInstanceId`, `campaignId`, `leadId` if already known before hash (see ingest order), `correlationId`, `source`, and `attributes`.

Exclude `eventId`, `recordedAt`, `canonicalHash`, `receiptId`, and `attribution`. Attribution is chosen by the server. Adapters do not send `canonicalHash`. The server computes it after lead resolution. `422 CANONICAL_HASH_MISMATCH` applies only if a later client sends a hash and it disagrees. The MVP adapter omits the field.

`leadId` rule for the hash: the adapter omits `leadId` unless a human or a previous response supplied one. The server resolves the lead, then stores the resolved `leadId` on the document. The stored `canonicalHash` is the server’s hash after lead resolution, so two races that create the same lead still match. Implementation order inside the transaction:

1. Resolve binding and tenant.
2. Resolve or create the lead.
3. Compute canonical hash including that `leadId`.
4. Read `businessEvents/{eventId}`.
5. If absent, create it.
6. If present and `canonicalHash` matches, return the existing event with `replayed: true`.
7. If present and the hash differs, return `409 IDEMPOTENCY_CONFLICT` and do not write.

### Immutability

The API provides no PATCH or DELETE for business events. A fact that was wrong is corrected by an operator note on a reconciliation item, or by a later event that the catalog already allows (`LeadDisqualified` after `LeadQualified`). The projection uses the latest qualification event by `occurredAt`, then `recordedAt`.

## Catalog

Only these `eventType` values are valid for `schemaVersion` 1. Anything else is `422 UNKNOWN_EVENT_TYPE` and a dead letter.

| `eventType` | Creates a lead if none matches | Updates |
| --- | --- | --- |
| `LeadCaptured` | yes | Lead identity fields, first campaign |
| `InboundCallReceived` | yes, if a counterparty phone is present | Lead phone |
| `InboundCallAnswered` | no | Call projection inside `attributes` only |
| `InboundCallMissed` | no | |
| `MissedCallRecovered` | no | |
| `SmsMessageReceived` | yes, if a counterparty phone is present | Lead phone |
| `SmsMessageSent` | no | |
| `EmailMessageReceived` | yes, if a counterparty email is present | Lead email |
| `EmailMessageSent` | no | |
| `FollowUpAttempted` | no | |
| `LeadQualified` | no | `qualification/current`, lead `status` |
| `LeadDisqualified` | no | `qualification/current`, lead `status` |
| `HumanEscalationRequested` | no | `lead.escalationOpen = true` |
| `AppointmentBooked` | yes | Appointment `booked` |
| `AppointmentAttended` | no | Appointment `attended` |
| `AppointmentNoShow` | no | Appointment `no_show` |
| `OpportunityValued` | no | `lead.estimatedValue` |

### Shared attribute limits

Unknown attribute keys are `422 UNKNOWN_ATTRIBUTE`. Strings are at most 500 characters. This keeps a transcript out of Firestore. Bodies, subjects, and recordings go to Cloud Storage and are referenced by id.

### `LeadCaptured`

| Attribute | Required |
| --- | --- |
| `captureChannel` | yes. `form`, `call`, `sms`, `email`, `manual` |
| `email` | one of `email`, `phone`, `externalContactId` |
| `phone` | same |
| `externalContactId` | same |
| `givenName` | no |
| `familyName` | no |
| `organization` | no |

### Call events

`InboundCallReceived` requires `callId`, `fromPhone`, `toPhone`, `direction=inbound`.

`InboundCallAnswered` requires `callId` and `answeredAt`. Optional `answerLatencyMs` (integer, ≥ 0).

`InboundCallMissed` requires `callId`. Optional `reason`: `no_answer`, `busy`, `after_hours`, `abandoned`, `unknown`.

`MissedCallRecovered` requires `callId` (the missed call), `recoveredBy` (`call`, `sms`, `manual`), and `recoveredAt`.

`callId` is the provider’s call identifier copied into attributes so reports can group legs without reading `source`. `source.providerEventId` for a received call should equal `callId`. Answered, missed, and recovered events use their own provider event ids (the vendor’s notification id) and still carry `callId`.

### Message events

`SmsMessageReceived` and `SmsMessageSent` require `conversationId`, `messageId`, `fromPhone`, `toPhone`.

`EmailMessageReceived` and `EmailMessageSent` require `conversationId`, `messageId`, `fromEmail`, `toEmail`.

Optional on all four: `artifactReceiptId` pointing at a body or attachment receipt. The body itself is not an attribute.

`FollowUpAttempted` requires `channel` (`call`, `sms`, `email`, `manual`). Optional `attemptNumber` (integer ≥ 1), `sequenceKey` (opaque string, not a vendor workflow name required), `outcome` (`sent`, `failed`, `answered`, `unknown`).

### Qualification and escalation

`LeadQualified` and `LeadDisqualified` require `reasonCode` (stable slug, ≤ 64 chars) and `actor` (`automation` or `human`). Human actors require `actorId` (Firebase uid or a staff external id already stored on the operator profile). The event must resolve to an existing `leadId` or it is `422 LEAD_REQUIRED`.

`HumanEscalationRequested` requires `reasonCode` and `channel` (`call`, `sms`, `email`, `manual`). Optional `severity`: `routine` or `urgent`.

### Appointments

`AppointmentBooked` requires `providerAppointmentId`, `startAt`, `endAt`, `timezone`. Optional `locationType`: `phone`, `video`, `in_person`, `unknown`. `endAt` must be after `startAt`.

`AppointmentAttended` and `AppointmentNoShow` require `providerAppointmentId` and `confirmedBy` (`provider` or `human`). The appointment must already exist. Absence is `422 APPOINTMENT_UNKNOWN`, and the event is dead-lettered rather than creating a phantom visit.

### Value

`OpportunityValued` requires `amountMinor` (integer ≥ 0), `currency` (ISO-4217), and `basis`. MVP accepts only `basis=estimate`. The lead must already exist.

## Idempotency implementation

Document ID is the idempotency key. There is no second “idempotency keys” collection in the MVP.

| Case | HTTP | Body flag | Firestore write |
| --- | --- | --- | --- |
| New event | 201 | `replayed: false` | Create event and projections |
| Same id, same `canonicalHash` | 200 | `replayed: true` | None |
| Same id, different hash | 409 `IDEMPOTENCY_CONFLICT` | | None. Dead letter `idempotency_conflict` |
| Same provider event arriving through n8n and a direct adapter with `upstreamEventId` set | 200 | `replayed: true` | None on the second call |

The transaction is the only writer. Retries from Cloud Run or the adapter are safe.

Human `POST` endpoints that create tenants, campaigns, and bindings take an `Idempotency-Key` header (UUID). The server stores `tenants/{tenantId}/idempotency/{key}` for configuration writes, with the response status and resource id, for 24 hours. Event ingest does not use that header. It uses `providerEventId`.

## Result calculation

Function `computeLeadCaptureResults(events, policy, window)` is pure. `GET /v1/results` and the nightly snapshot both call it. Window is half-open `[periodStart, periodEnd)` on `occurredAt`.

Counts use distinct business ids, not raw document counts where a retry could have duplicated a logical fact. Idempotency already collapses provider retries. Distinctness below covers multiple event types that refer to one call or one lead.

| Metric key | Unit | Formula for `lead-capture-metrics-v1` |
| --- | --- | --- |
| `callsReceived` | count | Distinct `callId` on `InboundCallReceived` |
| `callsAnswered` | count | Distinct `callId` on `InboundCallAnswered` whose `callId` was also received in or before the window |
| `callsAnsweredRate` | ratio | `callsAnswered / callsReceived`. Null when received is 0 |
| `missedCalls` | count | Distinct `callId` on `InboundCallMissed` |
| `callsRecovered` | count | Distinct `callId` on `MissedCallRecovered` whose `recoveredAt` is within `recoveryWindowHours` after the missed event’s `occurredAt` |
| `leadsCreated` | count | Distinct `leadId` on `LeadCaptured`, plus leads created by call, SMS, email, or booking events in the window that have no `LeadCaptured` |
| `qualifiedLeads` | count | Leads whose qualification state at `periodEnd` is `qualified` and whose qualifying event `occurredAt` is inside the window |
| `disqualifiedLeads` | count | Same for `disqualified` |
| `appointmentsBooked` | count | `AppointmentBooked` whose `occurredAt` is in the window |
| `appointmentAttendance` | count | `AppointmentAttended` in the window |
| `appointmentNoShow` | count | `AppointmentNoShow` in the window |
| `appointmentAttendanceRate` | ratio | Attended divided by attended plus no-show in the window. Booked-but-not-yet-due appointments are excluded |
| `humanEscalations` | count | `HumanEscalationRequested` |
| `smsConversations` | count | Distinct `conversationId` on SMS events |
| `emailConversations` | count | Distinct `conversationId` on email events |
| `followUpAttempts` | count | `FollowUpAttempted` |
| `responseTimeMedianSeconds` | seconds | Median of first outbound minus first inbound per `correlationId`. Outbound types: `SmsMessageSent`, `EmailMessageSent`, `FollowUpAttempted`, `InboundCallAnswered` |
| `responseTimeMedianBusinessSeconds` | seconds | Same median, counting only seconds inside `policy.businessHours` and the tenant timezone |
| `unknownCampaignEvents` | count | Events in the window with `attribution=unknown` |
| `estimatedOpportunityValueMinor` | minor units | Sum of the latest `OpportunityValued.amountMinor` per lead where `basis=estimate` and the event is in the window. Currency must be a single currency or the metric is returned as `null` with note `mixed_currency` |

`callsAnsweredRate` is a convenience field. Clients that need a different denominator recompute from the counts. The snapshot stores both counts and rates.

Leads created by a call are included in `leadsCreated` so a phone-only client is not reported as zero leads. A `LeadCaptured` for a lead that was already created by a call in the same window counts once.

## Projection rules

Applied in the same transaction as the event insert. A replay does not re-apply them.

- Identity arrays on the lead gain the event’s phone or email if that value is new.
- First non-empty `campaignId` on the lead sticks.
- `LeadQualified` sets status `qualified` only if there is no later `LeadDisqualified` already stored with a greater `occurredAt`. Because events are immutable and may arrive out of order, the transaction re-reads qualification events for that lead when the new event’s `occurredAt` is older than `qualification.current.occurredAt`, and keeps the later one.
- `OpportunityValued` replaces `estimatedValue` only when its `occurredAt` is greater than or equal to the value already stored. Ties use `recordedAt`.

Out-of-order protection is required. Providers retry and webhooks reorder.

## Raw receipts

The event stores `receiptId` only. The mapping from vendor JSON to `attributes` happens in the adapter. The server checks that attributes match this contract. It does not re-parse GoHighLevel, Twilio, or any other vendor schema. That parse stays in the adapter so a vendor change does not require a domain migration.

## Versioning

| Change | Version impact |
| --- | --- |
| New optional attribute | `schemaVersion` stays `1` |
| New `eventType` | Minor contract note. Still `schemaVersion` 1 if old readers ignore unknown types. MVP readers reject unknown types, so a new type requires a coordinated deploy and a minor API version note |
| Remove or rename an `eventType` | `schemaVersion` 2 and `/v2` |
| Change a metric formula | New `metricPolicyVersion`. Old snapshots keep the version they were computed with |

## Errors that belong to this contract

`UNKNOWN_EVENT_TYPE`, `UNKNOWN_ATTRIBUTE`, `CANONICAL_HASH_MISMATCH`, `IDEMPOTENCY_CONFLICT`, `LEAD_REQUIRED`, `APPOINTMENT_UNKNOWN`, `APPOINTMENT_CONFLICT`, `TENANT_MISMATCH`, `INSTANCE_NOT_ACTIVE`, `TENANT_SUSPENDED`.

HTTP mapping is in [10-mvp-api-contract.md](./10-mvp-api-contract.md).
