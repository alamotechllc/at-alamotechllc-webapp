# MVP test plan

**Status:** Specification of the tests to write with the control plane. No tests are added to the marketing site in this task.  
**Date:** 2026-10-23

## Executive takeaway

The build is not done until tenant isolation, idempotent ingest, metric math, and the deny-all Firestore rules are covered by automated tests. The marketing site does not need a new suite for this MVP, because it does not gain a Firebase client.

---

## Where tests run

Control-plane repository, when it exists:

| Layer | Tooling expectation | Depends on cloud |
| --- | --- | --- |
| Unit | Pure functions, no network | No |
| Integration | Firestore and Auth emulators, local HTTP | Emulators only |
| Security | Rules unit tests plus API authorization tests | Emulators |
| Adapter contract | Mapper fixtures recorded from sanitized payloads | No live vendor in CI |
| Reconciliation | Fixture provider, not production GoHighLevel | No |

CI must run unit, integration, and security suites on every change. A test failure blocks deploy. Production credentials are not available to CI.

## Unit tests

### Event contract

- Accept each catalog `eventType` with its required attributes.
- Reject an unknown `eventType` and an unknown attribute key.
- Reject a phone that is not E.164 and an email that is empty after normalization.
- Reject `AppointmentBooked` when `endAt` is not after `startAt`.
- Reject `OpportunityValued` when `basis` is not `estimate` or `amountMinor` is negative.
- Canonical hash is stable for the same payload and changes when `occurredAt` or an attribute changes.
- Hash input excludes `recordedAt` and `receiptId`.

### Idempotency

- Same `tenantId`, `provider`, and `providerEventId` produce the same `eventId`.
- Different tenants produce different ids for the same provider event id.
- When `upstreamProvider` and `upstreamEventId` are set, the hash uses those values.
- Replay with the same canonical hash is reported as a replay and does not call the projection twice.
- Replay with a different hash is a conflict and does not write.

### Lead identity

- Phone match returns the existing lead.
- Email match returns the existing lead.
- External id match wins over phone and email.
- Phone hit and email hit on two different leads do not merge. The event attaches by channel, and `possibleDuplicateOf` is set.
- `LeadQualified` without a resolvable lead fails.
- A second `LeadCaptured` for the same phone does not create a second lead.
- Operator merge repoints identity index rows and new events land on the winner.

### Attribution

- Explicit campaign id on the correct instance wins.
- A campaign id from another tenant is rejected.
- Binding default applies when the event omits a campaign.
- Route match on destination phone beats the default.
- No match stores `attribution=unknown` and still stores the event.

### Results

Fixture timelines, all in one tenant and instance, policy `recoveryWindowHours=24`, timezone `America/Chicago`.

| Fixture | Expected |
| --- | --- |
| Two received, one answered | `callsReceived=2`, `callsAnswered=1`, rate `0.5` |
| One missed call, recovery 23 hours later | `callsRecovered=1` |
| Recovery 25 hours later | `callsRecovered=0`, and the recovered event still exists |
| Same lead via call and later `LeadCaptured` in one window | `leadsCreated=1` |
| Qualify then disqualify | `qualifiedLeads=0`, `disqualifiedLeads=1` at period end |
| Disqualify with an earlier `occurredAt` arriving after qualify | Current state stays qualified |
| Two `OpportunityValued` in different currencies | value metric null, note `mixed_currency` |
| Booked, attended, no-show on three appointments | counts 1, 1, 1. Attendance rate `0.5` |
| Inbound at 16:50 and outbound at 09:10 next business day | business-hours median counts only the in-hours gap |

The result function is tested without Firestore.

### Redaction

- A log record built from an ingress body does not contain the denylist keys from the security model.
- A thrown error that includes the request in its cause is still redacted.
- `secretValue` never appears in a structured log fixture.

## Integration tests

Use the Firestore emulator and the Firebase Auth emulator. No production project.

### Ingest transaction

- First POST creates the event, the lead, the identity index, and the receipt metadata.
- Second POST returns 200 `replayed: true` and the document count does not change.
- Conflict POST returns 409 and the original document is unchanged.
- Suspended tenant returns 409 and writes nothing.
- Instance in `draft` returns 409.
- Out-of-order `LeadDisqualified` with an older `occurredAt` does not override a newer qualification.
- `AppointmentAttended` before `AppointmentBooked` returns 422 and a dead letter, and does not create an appointment.
- Batch of 20 processes item by item. One bad item does not roll back a good item.
- Batch of 21 is `400 VALIDATION_FAILED`.

### Receipts

- Inline receipt bytes land in the emulator storage or a fake bucket under `tenants/{tenantId}/...`.
- A path traversal in a caller-supplied object name is ignored because the server generates the path.
- Receipt document contains `sha256` and not the body.

### Configuration idempotency

- Same `Idempotency-Key` and same body returns the original tenant.
- Same key and a different body returns 409.

## Security tests

### Rules

Against the emulator, with the prototype rules from the security model:

- Unauthenticated client SDK read of `tenants/{id}/leads` is denied.
- Signed-in client SDK read and write, including a user with a `tenantId` custom claim, is denied.
- Client SDK write of a business event is denied.

These tests fail if someone opens a collection to the client to “make the dashboard easier.”

### API authorization

Mint emulator users for two tenants and one operator assigned only to tenant A.

| Case | Expected |
| --- | --- |
| Tenant A viewer `GET` tenant B leads | `403` or `404` as specified, and zero documents from B in the body |
| Tenant A viewer `POST` a binding | `403 PERMISSION_DENIED` |
| Tenant viewer `POST` receipt URL | `403` |
| Operator assigned to A `GET` tenant B | `403` |
| Operator `GET` binding does not include `secretResource` | field absent |
| Platform admin `GET` tenant B | 200, and an audit event `tenant.read` or the route’s read audit |
| Adapter SA calling `raas-api` `GET /v1/tenants` | `401` or `403` |
| Firebase user calling `POST /v1/ingress/events` | `401` or `403` |
| Adapter SA for voice submitting `source.provider=gohighlevel` | `403` |
| Body `tenantId` for tenant B with a binding in tenant A | `422 TENANT_MISMATCH`, no write in B |
| Revoked member with an unexpired custom claim | `403` because membership is re-read |
| Scheduler token on `POST /v1/ingress/events` | denied |
| User token on `POST /internal/v1/jobs/retention` | denied |

### Logging

Integration test captures the test logger and asserts a full ingest of a lead with phone and email does not log those values or the raw receipt.

### Secrets

A fake Secret Manager records that `secretValue` was sent to `addVersion` and that the Firestore binding document does not contain that string.

## Dead-letter tests

- 422 on ingest writes one open dead letter and no business event.
- 409 conflict writes one dead letter and leaves the original event.
- 200 replay writes no dead letter.
- Discard route sets status `discarded` and writes an audit event.
- `POST /v1/ingress/dead-letters` does not create a business event.

## Reconciliation tests

- Fixture provider lists three appointments. Two already exist as `AppointmentBooked`. The job submits one ingress call and writes a run with `seen=3`, `submitted=1`, `replayed=2`.
- A second job run submits nothing new.
- `webhook_only` binding writes a run with null counts and does not call a pull.
- `missing_in_control_plane` resolved by re-ingest uses the normal idempotent path.

## Index and query tests

- The results query for a window uses `serviceInstanceId` plus `occurredAt` and is listed in the index spec. The test reads the index manifest and fails if that composite index is missing from the file that will be deployed.
- A static check fails if production source calls `collectionGroup(`.

## Marketing site

No new automated test is required in `at-alamotechllc-website` for this specification. A later change that adds `firebase` or `firebase-admin` to that `package.json` should fail review. Optional CI guard, when the control plane work starts to touch this repo: a check that those package names are absent. That guard is not part of the MVP build.

## Exit criteria for the first deployable build

- Unit, integration, and security suites pass in CI.
- Deny-all rules are the rules deployed to the dev project, verified by the rules tests.
- One design-partner tenant can show the metric fixture through `GET /v1/results` with numbers matching the unit fixtures.
- A replayed provider webhook does not change those numbers.
- A token for a second tenant cannot read the first tenant’s leads.
- Application logs for that demo contain no email and no phone.
- The marketing repository has no Firebase data client for this project.

## Out of scope for the MVP suite

- Load tests beyond the rate-limit unit check.
- Live GoHighLevel certification. Recorded fixtures plus one manual reconciliation in dev before the first external client.
- Penetration test by an outside firm. The security suite above is the engineering bar. An external test can follow before a second client.
- Browser tests of `alamotechllc.com`.
