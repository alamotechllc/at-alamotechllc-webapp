# Milestone 1 plan — Alamo Tech Lead Capture path

**Date:** 2026-10-23  
**Status:** Plan only. Application functionality was not implemented.

## Executive takeaway

Milestone 1 is one path for Tenant Zero (Alamo Tech LLC): a Lead Capture service instance, a GoHighLevel provider binding, an `AppointmentBooked` event, authenticated ingress, Firestore, result calculation, an authenticated API, and an Alamo Tech RaaS dashboard. The control plane already demonstrates that path on Firebase emulators, except the dashboard and except production-grade Google OIDC and a live GoHighLevel signature. Build the dashboard in this repository against that API. Do not reimplement the domain, the ingest transaction, or a second Firestore model. Do not provision GCP in this milestone until the product owner approves project creation.

---

## Scope fence

In:

```text
Tenant Zero
  → Lead Capture service instance
  → GoHighLevel provider binding
  → AppointmentBooked
  → authenticated ingress
  → Firestore
  → result calculation
  → authenticated API
  → Alamo Tech RaaS dashboard
```

Out:

- Security, Automation, Compliance, and Technology RaaS
- The rest of the business-event catalog as live ingest (`LeadCaptured`, calls, SMS, email, qualification, attendance, value)
- MailGuard, Web Exposure, Assessments, and the platform Services module
- Public lead capture on the marketing site, n8n form posts, and the marketing `/raas` page
- Reconciliation, retention jobs, dead-letter operations, receipt download, and billing
- Production DNS, `app.alamotechllc.com`, and creating or renaming cloud projects
- A second repository
- Client SDK access to operational Firestore

The draft PRD's broader "platform foundation" milestone is not this plan. A signed-in Alamo Tech operator who can see Tenant Zero Lead Capture results is the acceptance surface.

---

## Existing components to reuse

| Step | Reuse | Where |
| --- | --- | --- |
| Tenant Zero | Fixed ids and `seedTenantZero` | `raas-control-plane/packages/domain/src/tenantZero.ts`, `packages/store/src/seed.ts` |
| Lead Capture product and instance | `raasProducts/lead-capture` and `serviceInstances/ins_01BRZ3NDEKTSV4RRFFQ69G5FAB` | Same seed |
| GoHighLevel binding | `POST /v1/tenants/{tenantId}/provider-bindings` for provider `gohighlevel`, channel `calendar` | `services/raas-api` |
| Appointment mapping | `mapGhlAppointmentCreate` | `packages/domain` |
| Provider entry | `POST /webhooks/gohighlevel/{externalAccountId}` plus fixture `fixtures/ghl-appointment-booked.json` | `services/ghl-adapter` |
| Authenticated ingress | Binding resolve and `POST /v1/ingress/events`, idempotent event id, replay, conflict | `services/raas-ingress`, `packages/store` |
| Firestore | Admin SDK, deny-all client rules, deny-all storage rules | `packages/store`, `firestore.rules`, `storage.rules` |
| Result calculation | `computeLeadCaptureResults` via `GET /v1/tenants/{tenantId}/results` | `packages/domain/src/results.ts` |
| Human API auth | Firebase ID token verified by Admin SDK; role and membership checks | `services/raas-api`, `packages/store/src/authorize.ts` |
| Local identity for tests | Auth emulator and `scripts/print-dev-token.ts` | Control plane |
| Tests already in CI | Unit tests plus emulator milestone and rules tests | `raas-control-plane/.github/workflows/ci.yml` |
| Contracts | Unedited copies | `docs/raas/06` through `docs/raas/12` in this repo |
| Visual language, when the UI is built | Logo and color tokens, copied, not imported | Marketing site, listed in `docs/architecture/overview.md` |

Roles the API already enforces: `platform_admin`, `operator`, `tenant_admin`, `tenant_viewer`. The dashboard uses those names. `platform_operator` in the PRD is `operator`. `tenant_user` is not added in this milestone.

---

## New components required

All of these are absent from `at-alamotechllc-webapp`.

| Component | Purpose |
| --- | --- |
| `apps/web` | Authenticated RaaS dashboard for Alamo Tech |
| Firebase Auth client, sign-in only | Google for operators. Email link only if a Tenant Zero user without Google is in scope. Anonymous sign-in stays off |
| API client | Sends `Authorization: Bearer` to `raas-api`. No Firestore SDK |
| Dashboard views | Tenant Zero identity, Lead Capture instance status, binding status without secret material, latest `AppointmentBooked` projection, results for a from/to window |
| Empty, denied, and error states | Failed API calls show an error or an empty state for this tenant. They do not fall back to another tenant |
| Environment file | API origin and Firebase Auth emulator settings for local DEV. Example file only. No secrets committed |
| Web test and CI | Typecheck, lint, and a dashboard test that mocks the API. Emulator end-to-end can call the existing control-plane suite rather than duplicating it |
| Real `scripts/build.sh` and `scripts/test.sh` | Replace the exit-0 placeholders once `apps/web` exists |

Not new, and not rebuilt:

- Domain package, result formulas, ingest, rules, adapter, ingress, or API routes that already exist.
- `resultSnapshots` and Cloud Scheduler. On-demand `GET /results` is the Milestone 1 calculation.
- Pub/Sub. The ingest path finishes inside the request.
- Secret Manager and Cloud Storage clients beyond the interfaces the control plane already has. Local file stores remain the emulator binding.

---

## Work sequence when implementation is approved

1. **Confirm the open decisions** at the bottom of this plan. Implementation of the dashboard can start against emulators before cloud projects exist. Implementation must stop before any `gcloud` or `firebase deploy`.
2. **Keep the control-plane suite green.** `npm run typecheck`, `npm run lint`, and `npm test` in `raas-control-plane`. That is the proof of Tenant Zero through results.
3. **Seed and bind Tenant Zero locally** using the existing seed and binding POST. The seed creates the tenant and the Lead Capture instance. The binding POST creates the GoHighLevel calendar binding and stores the signing secret outside Firestore.
4. **Submit the sanitized fixture** through the adapter. Expect a business event, a lead projection, and an appointment projection under Tenant Zero. A second identical post returns `replayed: true`. A different body with the same provider event id returns `409 IDEMPOTENCY_CONFLICT`.
5. **Read results** with a Firebase ID token for a platform admin or an assigned operator. Required query: `serviceInstanceId`, `from`, and `to`.
6. **Scaffold `apps/web`** in this repository. Vite, React, and TypeScript match the only Alamo Tech UI stack and the TypeScript capability pack. Strict TypeScript. The app talks to `http://127.0.0.1:8091` in local DEV.
7. **Sign in against the Auth emulator.** The dashboard loads Tenant Zero only after `raas-api` accepts the token. The tenant id is the known Tenant Zero id. The API still checks the caller. A token for the second fixture tenant (`ten_01CRZ3NDEKTSV4RRFFQ69G5FAC`) must not see Alamo Tech results.
8. **Render the path.** Show legal name Alamo Tech LLC, product Lead Capture, instance status, binding provider and status, appointment count or list from the API, and the metric map returned by `GET /results`. Hide secret resource names from every role except `platform_admin`, matching the API.
9. **Prove the browser has no operational Firestore client.** Dependency review and a test or build check that `firebase/firestore` and `firebase-admin` are absent from `apps/web`.
10. **Leave live GoHighLevel and Google OIDC as a follow-on** inside `raas-control-plane`, after the signature scheme is confirmed and a dev project is approved. The dashboard does not change when that follow-on replaces the fixture HMAC and the local JWT.

---

## Local emulator strategy

Use the control plane's emulators. Do not point them at a cloud project.

| Process | Bind | Project |
| --- | --- | --- |
| Firestore emulator | `127.0.0.1:8080` | `demo-raas-cp` |
| Auth emulator | `127.0.0.1:9099` | `demo-raas-cp` |
| `raas-api` | `127.0.0.1:8091` | `FIREBASE_PROJECT_ID=demo-raas-cp` |
| `raas-ingress` | `127.0.0.1:8092` | Same |
| `ghl-adapter` | `127.0.0.1:8093` | `OIDC_MODE=local` |
| `apps/web` | Local Vite port | Auth emulator plus API origin `http://127.0.0.1:8091` |

`FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` must be set for the services. Secrets and receipts stay under `.local/` with `SECRET_STORE=file`, shared by the API and the adapter. JDK 17 and Node.js 22 match the current CI job.

The dashboard's Firebase config for local DEV uses the emulator and `demo-raas-cp`. It does not use marketing `VITE_FIREBASE_*` values.

---

## CI changes

| Repository | Change |
| --- | --- |
| `raas-control-plane` | No change for the emulator path. The current workflow already runs typecheck, lint, unit tests, and `firebase emulators:exec` for Auth and Firestore |
| `at-alamotechllc-webapp` | `origin` is `https://github.com/alamotechllc/at-alamotechllc-webapp.git`. The GitHub repository is empty until the first push. CI is `.github/workflows/ci.yml`: typecheck, lint, the frontend import guard, unit tests, and emulator tests. No deploy job |

Do not add a deploy job. Do not add GCP credentials to CI for Milestone 1.

The control-plane emulator tests remain the system test for ingest, tenant isolation, replay, conflict, and deny-all rules. The web tests cover sign-in state, an authorized results render, a 403 render, and an empty window.

---

## Firebase and GCP resources

Required by the approved design, and **not created by this plan:**

| Resource | When it becomes real | Milestone 1 local substitute |
| --- | --- | --- |
| Firebase/GCP project for DEV | Separate approval. Proposed name `raas-cp-dev`. Region confirmed before database create, default `us-central1` | Emulator project `demo-raas-cp` |
| Production project | After DEV review. Proposed name `raas-cp-prod` | None |
| Firebase Authentication | With the DEV project. Google provider. Anonymous off. Operator hosted domain confirmed before the first staff user | Auth emulator |
| Firestore Enterprise `(default)` | With the DEV project. Deploy deny-all rules with the database | Firestore emulator and `firestore.rules` |
| Cloud Run `raas-api`, `raas-ingress`, `ghl-adapter` | After DEV project approval. Invoker is not `allUsers` | Local processes |
| Service accounts for those services | Same approval | Local JWT for the adapter only |
| Secret Manager | Adapter secret for the live binding | `.local/secrets` |
| Cloud Storage receipts bucket | Uniform bucket-level access, public access prevention | `.local/receipts` |
| Cloud Logging | 30-day application bucket, redaction before the log call | JSON logs on stdout |
| Cloud Monitoring alerts | Log-based metrics from the security model, when logs exist in a project | Not in local Milestone 1 |
| Firebase Hosting for `apps/web` | After the hosting decision and the DEV project | Vite dev server |
| Cloud Scheduler | Snapshot, reconciliation, and retention jobs. Outside this path | On-demand results GET |
| Pub/Sub | Only if a later measurement shows the request cannot finish ingest | Not used |
| Cloud Functions | Not in the approved runtime | Not used |

`app.alamotechllc.com` and any DEV hostname for the dashboard stay unregistered until a DNS approval.

---

## Security checks that belong to this milestone

- Operational reads and writes go through the API and the Admin SDK.
- `firestore.rules` and `storage.rules` stay deny-all.
- Binding responses used by the dashboard omit secret values. `secretResource` is visible only to `platform_admin`, which is already the API behavior.
- Logs continue to drop tokens, `secretValue`, raw provider JSON, and contact fields. The dashboard does not log the ID token.
- A revoked membership fails closed because the API reads membership on each request.
- Cross-tenant access returns the same not-found or forbidden result the API already returns. The UI must not reveal the other tenant's id.

---

## Acceptance for the local milestone

- Seed produces Alamo Tech LLC as Tenant Zero and one active Lead Capture instance.
- An authorized caller can create one GoHighLevel calendar binding for `loc_tenant_zero_fixture`.
- The sanitized appointment fixture becomes `AppointmentBooked` in Firestore and is visible through the authenticated API.
- `GET /results` for that instance and window returns the approved metric map, including the booked appointment.
- Replay and idempotency conflict behave as the control-plane tests already require.
- A user without membership or assignment cannot open the Alamo Tech dashboard data.
- The dashboard shows that path for an authorized Alamo Tech user.
- The web bundle does not contain an operational Firestore client or the Admin SDK.
- No cloud project, DNS record, or marketing-site deploy was changed.

---

## Decisions that need product-owner approval

| Decision | Why it is blocking | Default if work must proceed locally |
| --- | --- | --- |
| Colocate `raas-control-plane` into this repository | Approved records say the code stays there. The single-repo preference is conditional | Leave the code there. Build only `apps/web` here |
| Hosting platform | Deployment requirements leave it unselected | Vite dev server locally. Firebase Hosting is the recommendation, not a provisioned resource |
| Shared DEV project for Hosting and Cloud Run | Two projects would split Firebase Auth | One project per environment when creation is approved. Names `raas-cp-dev` and `raas-cp-prod` stay proposals |
| Deployed API origin | Copied contract says `https://alamotechllc.com/api/raas`. That route is not deployed, and ADR 14 does not approve a DreamHost proxy | Local origin `http://127.0.0.1:8091` |
| Live GoHighLevel versus the fixture | The vendor signature scheme is unconfirmed | Fixture HMAC on the emulator. No public adapter |
| Google OIDC versus local JWT | The contract requires OIDC for adapters. CI has no GCP credentials | Local JWT only when `OIDC_MODE=local` |
| `tenant_user` and permission strings (`raas.view`, `raas.manage`) | They are not in the API matrix | Use the four API roles only |
| App Check | Architecture overview requires it before a production client calls a Firebase-backed API. The security model waives it while Cloud Run IAM excludes the public | Not configured for the emulator milestone |
| Operator hosted domain | Security model expects `alamotechllc.com`, confirmed at project setup | Confirm before the first non-emulator staff user |
| Which contract copy wins when `06`, `10`, or `11` disagree | This repo now holds the later marketing copy. The control plane holds an older snapshot | Do not edit either copy in implementation. Follow this repo's `docs/raas/` for product rules |

Cloud project creation, DNS, and a repository move are outside Milestone 1 even after the dashboard is approved to start locally.
