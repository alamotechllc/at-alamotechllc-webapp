# Milestone 1 review

**Date:** 2026-10-23  
**Verdict:** PASS WITH FINDINGS  
**Scope:** Lead Capture RaaS as implemented in this repository. Reviewed against `docs/raas/08` through `docs/raas/12`. No Milestone 2 work.

The Milestone 1 slice holds: an `AppointmentBooked` event resolves through the binding, persists once, replays without a second appointment, rejects a conflicting payload with `409`, and the results API returns the right count. Two implementation defects contradicted the API contract and were corrected. The rest of the MVP contracts are not built. Those gaps are findings. They do not change the approved contracts.

## Result accuracy

Executed on the Auth and Firestore emulators against a fresh tenant, service instance, and GoHighLevel binding. Counts came from `GET /v1/tenants/{tenantId}/results`.

| Case | Result |
| --- | --- |
| One valid booking | `201`, `appointmentsBooked = 1` |
| Same provider event replayed | `200`, `replayed: true`, count stays `1` |
| Same provider event id, different `endAt` | `409 IDEMPOTENCY_CONFLICT`, original `endAt` unchanged, count stays `1` |
| Second unique booking | `201`, `appointmentsBooked = 2` |

The pure function also counts two `AppointmentBooked` events inside a half-open window and excludes the endpoints outside it. That unit test does not use Firestore.

## What was corrected

These defects did not match the approved API contract. The corrections follow that contract. No contract file was edited.

| Defect | Before | Correction |
| --- | --- | --- |
| Adapter bearer on a human route | `verifyIdToken` threw, and the handler returned `500` | Invalid Auth errors return `401 UNAUTHENTICATED`. Internal Auth failures still surface as `500` |
| Malformed JSON | Same handler returned `500` | `400 VALIDATION_FAILED` |
| Operator replay of an admin binding create | The stored idempotency response included `secretResource`, and the operator received it | The response is filtered on the way out. Operators still receive `secretPresent`. Platform admins still receive `secretResource`. `secretValue` was never returned |

Regression coverage is in `tests/emulator/boundary.test.ts`. After the correction: unit tests 8 files / 29 passed; emulator and rules tests 4 files / 17 passed; typecheck, lint, and the frontend import guard passed.

## Contract comparison

### Business events (`08`)

Implemented for `AppointmentBooked`: envelope fields, server-computed canonical hash after lead resolution, deterministic `evt_` id, transactional create, replay with no second projection, and conflict with no mutation of the original event. Provider names stay in `source`. Unknown attribute keys return `422 UNKNOWN_ATTRIBUTE`. `endAt` must be after `startAt`.

| Finding | Disposition |
| --- | --- |
| Catalog types other than `AppointmentBooked` return `422 EVENT_TYPE_NOT_IN_MILESTONE` | Intentional for this milestone. That code is not in the contract's error list. Unknown types still return `UNKNOWN_EVENT_TYPE` |
| A supplied `canonicalHash` is dropped. `CANONICAL_HASH_MISMATCH` is not implemented | The MVP adapter omits the hash. A later client that sends one is not checked |
| `422` validation does not write a dead letter. Unknown event types do not either | The contract says a dead letter accompanies those rejections. Only `IDEMPOTENCY_CONFLICT` writes one |
| Each new booking creates a new lead unless the caller supplies `leadId` | Phone, email, and external-id matching are not implemented. `AppointmentBooked` does not carry those attributes |
| `receiptId` is always null | Ingress discards `receipt.inlineBase64`. Receipt bytes are not stored |
| Conflict dead letters are written after the transaction | The original event is not modified. Two racing conflicts can write two letters |
| Binding create writes the binding, the index, and the audit event as separate writes | A crash between them can leave the index and the binding disagreeing |

### Provider adapter (`09`)

The GoHighLevel service maps only `AppointmentCreate` to `AppointmentBooked`. It does not import Firestore or `firebase-admin`. It resolves the binding through ingress, checks a local HMAC over the raw bytes, and does not put the vendor body on the business event. Contact fields on the fixture are not copied into attributes. An ignored vendor type returns `200` and does not call ingress. A bad signature returns `401` and does not call ingress. Conflict and ingress `422` are acknowledged to the vendor as HTTP `200` with `ingressStatus`. Ingress `500` / `503` retry up to five times and then return `500`.

| Finding | Disposition |
| --- | --- |
| Ingress identity is one shared local bearer, not a Google OIDC service account per adapter | Production mode fails closed. The allowlist is process-wide. A second adapter cannot be distinguished while it holds the same token |
| The signature scheme is local HMAC-SHA256 | Live GoHighLevel signing is unconfirmed. This must not be published |
| Mapper failures return `400` or `422` to the vendor and do not write a dead letter | The contract says ack `200` after ingress writes the letter. Ingress has no letter for a payload it never saw |
| Unknown bindings return vendor `401` before the signature is checked | The adapter cannot load a secret it cannot resolve. No root dead letter is written |
| Calendar pull is a function with no HTTP route and no live client | Bindings are stored as `webhook_only`. The API rejects any other mode |

### API (`10`)

Human routes verify a Firebase ID token and send `X-RaaS-Api-Version: 1` and `X-Request-Id`. Errors use the contract body. Implemented routes: tenant read, service-instance list, binding create and list, appointment list, event list, results read. Ingress: binding resolve and event submit.

Not implemented, and not filled with fake data: tenant list and create, members, operator assignment, campaigns, binding disable, leads, merge, escalation clear, receipt URLs, audit list, dead-letter list, reconciliation items, snapshots, batch ingest, receipt uploads, ingress dead letters, and scheduler jobs. Rate limits are not implemented. List routes return at most 50 items and `nextPageToken: null`. Event list does not apply the contract filters. Results require `serviceInstanceId`, `from`, and `to`, and return the metric map plus `metricPolicyVersion` and `generatedAt`.

Tenant readers in the contract include `tenant_viewer`. These routes call `authorizeOperatorAccess`, so a viewer receives `403 PERMISSION_DENIED` on reads and on binding create. That is stricter than the contract. `authorizeTenantRead` exists and is tested, and it is not wired to a route.

### Security model (`11`)

See `docs/raas/SECURITY-REVIEW.md`. Deny-all Firestore and Storage rules match the prototype. The Admin SDK is confined to the API, ingress, and store packages. The browser uses Firebase Auth and `raas-api`.

### Test plan (`12`)

Covered for this milestone: `AppointmentBooked` validation, canonical hash, deterministic ids, replay, conflict, tenant mismatch, operator isolation, deny-all rules, secret value absent from the binding document and from logs, adapter source boundary, and `appointmentsBooked` window math.

Not covered, because the behavior is not built: the full catalog attribute matrix, lead identity and merge, route attribution, the metric fixture table beyond booked appointments, receipt bytes, configuration idempotency for tenant create, batch ingest, revoked-member re-read on a human route, scheduler denial, dead-letter discard, and reconciliation runs. There is no static test that fails the build when `collectionGroup(` appears. Source was searched; production code does not call it. The index file lists a collection-scoped composite on `businessEvents`. `queryResults` reads the tenant subcollection and filters in memory, so that index is unused.

CI runs typecheck, lint, the frontend guard, unit tests, and emulator tests. There is no deploy job.

## Authorization and tenancy

| Check | Result |
| --- | --- |
| Operator assigned to tenant A reads tenant B | `403`, and the body does not contain tenant B's appointment id |
| Platform admin reads tenant A | `200`, and the appointment list does not contain tenant B's id |
| Body `tenantId` disagrees with the binding | `422 TENANT_MISMATCH`, no event written on the other tenant |
| Omitted `tenantId` | Tenant comes from `providerBindingIndex` |
| Repository helpers | Operational paths require `tenantId` and stay under `tenants/{tenantId}/...` |
| `NOT_FOUND` versus another tenant | A missing tenant is `404`. Another tenant's existing data is `403` for an unassigned operator, because the role check happens before the document read |

`providerBindingIndex` is the lookup that discovers `tenantId` before any tenant read. `appointmentIndex` is written during ingest and has no reader.

## Frontend

`apps/web` signs in with the Auth emulator, sends the ID token to `/v1`, and renders Appointments Booked from the results payload. Other Lead Capture labels render as `Not configured` with no number. A measured zero stays zero. An HTTP or network failure is an error state. The package depends on `firebase`, React, and React Router. It does not depend on `firebase-admin`, the Firestore client, or Secret Manager. The import guard scans the source for the backend packages.

The UI reaches `packages/domain/src/tenantZero.ts` by a relative path so the browser bundle does not pull `node:crypto`. That file is constants only. Authorization does not branch on those ids. The page still requests the tenant from the API and displays the returned `legalName`.

## Overbuild

Recommend leaving these until a later milestone needs them. Removing them is a product decision, not a change made in this review.

| Item | Why it is extra | Recommendation |
| --- | --- | --- |
| `appointmentIndex` | Written on every booking. Nothing reads it. The document sits outside the tenant tree | Remove when the next change touches ingest. Appointment reads already use the tenant subcollection |
| Full metric formulas and business-hours arithmetic | The contract defines them. Only `appointmentsBooked` is exercised. The API returns zeros for the rest. The UI does not present those zeros as measurements | Keep the function. Do not certify the other formulas until the test-plan fixtures exist. Do not show them as numbers |
| `authorizeTenantRead` | Unused by routes | Keep. It is the contract check for a later tenant reader. Wiring it now would widen access |
| `createAppointmentReconciler` pull loop | No route calls it. Binding create rejects `reconcileMode` other than `webhook_only` | Keep the `webhook_only` return. Do not add a scheduler that calls the pull loop |
| `@vitejs/plugin-react` | Present in `apps/web` and not used by the Vite config | Remove in a dependency cleanup. It is not on the runtime path |

Provider JSON stays in `services/ghl-adapter`. The core event type is `AppointmentBooked`.

## Not started

Live GoHighLevel signing, Google OIDC, Google Secret Manager, receipt storage, tenant-reader routes, rate limits, hosted-domain checks for operator tokens, audit rows for ordinary reads, and any Milestone 2 product surface.
