# Milestone 1 status

**Date:** 2026-10-23  
**Scope:** Local operator experience for Lead Capture `AppointmentBooked`. No live webhook and no cloud project.

## Executive takeaway

An operator signs in with the Auth emulator, opens RaaS, and sees Alamo Tech LLC, the Lead Capture service, and Appointments Booked `1`. That count comes from `raas-api`. Replaying the same provider event returns `replayed=true` and the count stays `1`. The browser sends the Firebase ID token and does not query operational Firestore. A sanitized GoHighLevel `AppointmentCreate` fixture still passes the local adapter into `raas-ingress` without a tenant id. Voice, SMS, email, forms, and pipeline mapping are not implemented.

## Implemented

| Area | What is in the repo |
| --- | --- |
| Domain | `Tenant`, `ServiceInstance`, `Campaign`, `ProviderBinding`, `Lead`, `Appointment`, `BusinessEvent`, `AuditEvent` in `packages/domain` |
| Catalog | All approved Lead Capture event types are recognized. Only `AppointmentBooked` is validated and ingested |
| Events | Envelope checks, canonical SHA-256, deterministic `evt_` id from tenant, provider, and provider event id |
| Results | Pure `computeLeadCaptureResults`. Milestone verification is `appointmentsBooked` on a half-open window |
| Tenant Zero | `seedTenantZero` writes the product, Alamo Tech LLC, the Lead Capture instance, and a `tenant.create` audit. The seed refuses to run unless `FIRESTORE_EMULATOR_HOST` is set and the project id starts with `demo-` |
| Authorization | Human routes verify the Firebase ID token, then re-read `platformAdmins`, `operators` plus assignments, or tenant membership. Claims are not the grant. See `docs/security/` |
| Data access | Operational reads and writes go through helpers that require `tenantId` and stay under `tenants/{tenantId}/...`. There is no collection-group query |
| API | `services/raas-api` verifies a Firebase ID token. Routes: tenant read, service-instance read, provider-binding create and list, appointment read, event read, results read |
| Ingress | `services/raas-ingress` authenticates the service identity, authorizes the provider, resolves the binding, derives `tenantId` and `serviceInstanceId`, validates the contract, writes the event and projections in one transaction, and returns `{ eventId, leadId, replayed, receiptId }`. `GET /v1/ingress/bindings:resolve` is the adapter lookup |
| GoHighLevel adapter | `services/ghl-adapter` accepts `POST /webhooks/gohighlevel/{externalAccountId}`, verifies the local HMAC, and maps only `AppointmentCreate` to `AppointmentBooked`. Vendor JSON stays in that service |
| Secrets | `@raas/secrets` is the Secret Manager boundary. `raas-api` calls `addVersion` and does not read. The adapter calls `access`. Local stores are memory and `.local/secrets`. No Google Secret Manager client is called |
| Rules | Firestore rules authorize tenant reads from an active role record. Provider bindings, events, audit, and secrets stay closed. Storage rules are deny-all. The browser does not call `raas-api` for ordinary reads |
| Frontend boundary | `apps/web` has no operational data client. `npm run guard:frontend` fails if that tree imports `firebase-admin`, the Firestore or Storage client, or the backend packages |
| Operator UI | `apps/web` reuses the Alamo Tech shell. Google is the sign-in action. The UI calls `GET /v1/session` and shows Overview, Clients, Appointments, Results, and Operations only after the API authorizes the principal. Appointments Booked is the only measured Lead Capture number. Other catalog metrics say `Not configured`. Leads, Campaigns, Integrations, and Administration are not routed |
| CI | `.github/workflows/ci.yml` runs typecheck, lint, the import guard, unit tests, and emulator tests. There is no deploy job. Operator deploy gates are in `deploy.md` at the repository root and stay off CI |

Local ports, chosen so they do not use `8080` while another emulator may already be there:

| Emulator | Port |
| --- | --- |
| Firestore | `8280` |
| Auth | `9198` |
| Storage | `9399` |
| API | `8091` |
| Ingress | `8092` |
| GoHighLevel adapter | `8093` |
| Operator UI | `5173` |

Project id `demo-raas-cp` is an emulator id. It is not a cloud project.

## Tests

| Suite | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Passed |
| Lint | `npm run lint` | Passed |
| Frontend guard | `npm run guard:frontend` | Passed |
| Unit and security | `npm run test:unit` | 8 files, 29 tests passed |
| Emulator integration and rules | `npm run test:emulators` | 4 files, 17 tests passed |

Covered:

- `AppointmentBooked` validation, including unknown attributes and `endAt` before `startAt`
- Catalog recognition and rejection of provider-named event types
- Canonical hash stability, lead id sensitivity, and key order
- Deterministic event id, including the upstream-provider case
- `appointmentsBooked` inside `[periodStart, periodEnd)`
- Log redaction of tokens, secrets, email, phone, names, message bodies, recordings, and signed URLs
- Seed refusal without the emulator, and refusal of a non-demo project id
- Tenant Zero seed, binding, ingest, replay, idempotency conflict, and results count
- The same authorization denial for a viewer whose tenant id is not Tenant Zero
- API authentication with Auth-emulator ID tokens: missing token `401`, operator of another tenant `403`, platform admin read of Tenant Zero
- Ingress authentication and provider allowlist: missing token `401`, disallowed provider `403`
- Binding resolution: omitted `tenantId` uses the binding; unknown account `404`; disagreeing `tenantId` `422`
- Replay `200` with no second appointment, conflict `409` with the original event unchanged, and a concurrent submit that leaves one appointment
- A sanitized `AppointmentBooked` with no `tenantId` persists once, is readable from `raas-api`, and yields `appointmentsBooked=1`
- An adapter bearer on a human route is `401`. Malformed JSON is `400`. An operator replay of an admin binding create does not receive `secretResource`
- GoHighLevel fixtures: valid booking, replay, malformed booking, missing fields, unknown location, and a conflicting appointment id
- The valid fixture produces `appointmentsBooked=1`, replay keeps that count, and the conflict fixture leaves the original event in place
- Firestore denies anonymous clients, signed-in users with no grant, and a platform-admin claim that has no active record
- Storage deny-all for an unauthenticated upload
- Metric presentation: a measured `appointmentsBooked` of `0` stays `0`, and an unconfigured metric returned as `0` stays `Not configured`
- Browser reads authorized tenant data from Firestore. Appointments Booked is counted from appointments the caller is allowed to read

`./scripts/build.sh` runs typecheck and the frontend guard. `./scripts/test.sh` runs unit tests and the emulator suite.

## Remaining work

- A confirmed live GoHighLevel signature and a public webhook
- Google OIDC for ingress
- The Google Secret Manager client and Cloud Storage receipt bytes
- GoHighLevel calendar pull (`GET /calendars/events`, scope `calendars/events.readonly`). The seam is documented in `docs/raas/GHL-APPOINTMENT-RECONCILIATION.md`
- Route-based campaign attribution
- The rest of the event catalog as ingest, not only recognition
- Result snapshots, reconciliation, retention, and dead-letter operations beyond the idempotency conflict record
- A real DEV Firebase/GCP project, after a separate approval
- Retiring or folding the earlier `raas-control-plane` slice so two implementations do not drift

## Deviations

| Item | Why |
| --- | --- |
| Foundation code is in this repository | The implementation instruction placed Milestone 1 here. `raas-control-plane` was not modified and was not removed |
| Emulator ports are `8280`, `9198`, and `9399` | `8080` was already in use. The approved contracts do not fix local ports |
| Ingress identity is a local bearer token plus a provider allowlist | Google OIDC is the contract for a deployed adapter. The process rejects callers unless `OIDC_MODE=local` and `FIRESTORE_EMULATOR_HOST` are both set. `LOCAL_ADAPTER_PROVIDERS` defaults to `gohighlevel` |
| Tenant readers use the same routes as operators | `tenant_admin` and `tenant_viewer` are authorized for the read permissions. Binding create stays with staff. The security model is `docs/security/RBAC.md` |
| `providerBindingIndex` and `appointmentIndex` sit beside the tenant tree | The binding index is the one lookup that discovers `tenantId` before any tenant-scoped read. The appointment index is a pointer, not a collection-group query. Operator assignments live at `operators/{uid}/assignments/{tenantId}` |
| `receiptId` is null | The adapter sends `receipt.inlineBase64`. Ingress drops it before the business event and does not write the receipt object |
| Local HMAC stands in for GoHighLevel signing | The vendor signature scheme is unconfirmed. `X-Provider-Signature` is HMAC-SHA256 of the raw body. This adapter is not for a public URL |
| A conflicting webhook is HTTP 200 to the vendor | Ingress still returns `409 IDEMPOTENCY_CONFLICT` and writes no second appointment. The adapter body includes `ingressStatus: 409` |
| Malformed and incomplete vendor payloads return `400` or `422` | The ingress dead-letter route is not built, so the adapter does not yet acknowledge those as HTTP 200. It does not call ingress |
| Campaign routes are not matched | Explicit `campaignId` and `defaultCampaignId` are applied. `attribution=route` waits for a later event that carries a route key |
| Other catalog types return `422 EVENT_TYPE_NOT_IN_MILESTONE` | They are recognized. Provider mapping for them is not implemented |
| `leadCreated` is stored on the event | The result function uses it. It is not an envelope field in the contract. Schema version stays `1` |
| Results are calculated in memory from the tenant's `businessEvents` | The pure function still applies the window. A composite query can wait until volume requires it |
| Local sign-in can still use the Auth emulator password | Google is the primary action. The emulator account `operator@alamotechllc.test` remains for local development. The password lives in `.env.example` and is not a production credential |
| Clients loads Tenant Zero by id | There is no tenant-list route. The page displays `legalName` from the tenant response |
| Only `appointmentsBooked` is shown as a number | The results API returns zeros for metrics this milestone does not measure. The page labels those `Not configured` |
| Dead letters and ingest failures say `Not configured` | Milestone 1 has no read route for those records. Operations shows events, binding status, and `webhook_only` reconciliation |
| The UI dev server proxies `/v1` to the local API | The browser does not receive a production API host |

The approved contracts in `docs/raas/06` through `docs/raas/12` were not edited.

## Security concerns

- Deny-all rules stop the client SDK. The Admin SDK does not evaluate those rules, so API authorization tests have to stay in CI.
- The local ingress token is a shared development secret. It must not be reused in a deployed service. Production mode fails closed.
- Binding create accepts `secretValue`, sends it to the local secret store, and drops it. Firestore stores `secretResource` only. The Google Secret Manager API is not called. A platform admin can read the resource name. An operator sees `secretPresent`.
- Logs redact the denylisted contact and credential fields. A new field name that holds the same data would need to be added to that list.
- App Check is not configured. Nothing here is deployed.
- `firebase-tools` warns that a future release will require Java 21. The current emulator run used the installed JDK and completed.
- `npm audit` reports transitive advisories in the Firebase tooling tree. They were not auto-fixed. Application code does not ship that tooling to a browser.
