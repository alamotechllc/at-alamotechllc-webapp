# Implementation audit — Lead Capture RaaS on the private web application

**Date:** 2026-10-23  
**Project:** `at-customer-webapp` (`at-alamotechllc-webapp`)  
**Status:** Audit and plan only. No application functionality was implemented. No cloud project was created or renamed.

## Executive takeaway

The private Alamo Tech web application is a registered product shell with no framework, no Firebase project, and no user interface. The Lead Capture path the MVP needs — Tenant Zero, a Lead Capture service instance, a GoHighLevel binding, `AppointmentBooked`, authenticated ingress, Firestore, and a results API — already runs against local Firebase emulators in the sibling repository `raas-control-plane`. The missing customer surface is the authenticated RaaS dashboard in this application. The least disruptive Milestone 1 reuses that control plane and adds the dashboard here. Folding the services into this repository, creating `raas-cp-dev`, and choosing the customer hosting platform still need a product-owner decision. Production DNS and cloud projects stay uncreated.

---

## Engagement record

`docs/service-relationship.md` is record version 2.

| Field | Value |
| --- | --- |
| Engagement class | `ACTIVE_PROJECT` |
| Classification status | `APPROVED` |
| Project | Lead Capture RaaS MVP |
| Owner | Alamo Tech LLC |
| Contract/retainer | N/A — internal product development |
| SLA | N/A — internal product development |

Version 1 on the same day was `NOT_APPLICABLE`. Version 2 follows the product-owner instruction and matches the class already written on the marketing site and on `raas-control-plane`. It does not authorize a retainer, an SLA, a cloud project, or a repository move.

---

## Approved contracts

The seven approved specifications were copied byte-for-byte from `at-alamotechllc-website/docs/raas/` into `docs/raas/`. They were not edited. That directory is the later approved decision record. `raas-control-plane/docs/contracts/` is an earlier snapshot. Four files match. Three do not.

| File | SHA-1 in this repo | Same bytes in `raas-control-plane` |
| --- | --- | --- |
| `06-control-plane-technology-decision.md` | `06b4226ba7a23e857c52f562ce7ed557d21a20b0` | No. Control-plane SHA-1 `1c34d8db77d6e9c7aa9c0e525c4920a560fbf333` |
| `07-control-plane-domain-model.md` | `ad66d7cee7deef5e7542f2e278fc032d6368e45d` | Yes |
| `08-business-event-contract.md` | `38a827a839429d68056eb2ade1bebd41728127fa` | Yes |
| `09-provider-adapter-contract.md` | `0d71536e21dfad76f85ed8c0792d6934f4258e15` | Yes |
| `10-mvp-api-contract.md` | `4ac775a241bccd092a91d6de32541e8a8219ac2a` | No. Control-plane SHA-1 `5e46e4341b1ca95ce4881719394b3463acef7e39` |
| `11-mvp-security-model.md` | `9c70720fa407c684b8a684102a238eba483fc19a` | No. Control-plane SHA-1 `07cf094456b4b4609077fb361c041af406902c54` |
| `12-mvp-test-plan.md` | `5a3a5c2803bff40c883e0b1e71d717b67225d82c` | Yes |

The three differences are editorial, and they matter:

| Topic | Copy now in this repo (website, later) | Copy in `raas-control-plane` (earlier) |
| --- | --- | --- |
| Repository | Milestone 1 code stays in `raas-control-plane` | Recommends creating `raas-control-plane` |
| Public API base | `https://alamotechllc.com/api/raas` with `/v1` under it. States that this routing is not deployed | Cloud Run origin |
| Ingress exposure | Public `/api/raas` and `/api/webhooks/raas` on `alamotechllc.com`, not routed | Deferred `raas-public` zone |

Copied files still link to `13-canonical-namespace-adr.md` and `03-raas-proposed-architecture.md`, which remain only on the marketing site. ADR 14 (`14-customer-platform-boundary-adr.md`) is also only on the marketing site. It places customer RaaS UI on this application at the future host `app.alamotechllc.com` and leaves Milestone 1 service code in `raas-control-plane`. Those ADRs were not copied, because this task asked for specifications `06` through `12` and forbade rewriting them.

---

## This repository

| Topic | Finding |
| --- | --- |
| Framework | None. No `package.json`, no UI framework, no server framework |
| Repository structure | AlamoOS registration: `alamo.manifest`, `docs/`, `scripts/build.sh`, `scripts/test.sh`, `.alamo/` |
| Project identity | `at-customer-webapp`. Display name Alamo Tech Customer Application. Alias `at-web-app`. Taxonomy `greenfield-app` |
| Git remote | None |
| Build and test | Both scripts exit 0. They do not compile or test an application |
| CI/CD | No `.github/workflows`. No Cloud Build file |
| Firebase configuration | No `firebase.json`, `.firebaserc`, or App Hosting file |
| Firebase project IDs | None in this repository |
| Firebase Authentication | Specified in `docs/architecture/overview.md` and `docs/raas/11-mvp-security-model.md`. Not configured |
| Firestore | Specified as Admin SDK only. No rules file and no database |
| Firebase Hosting / App Hosting | Not selected. `docs/deployment/requirements.md` says the hosting platform is not chosen |
| Cloud Functions | None |
| Cloud Run | None |
| Other GCP services | None created from this repository |
| Authentication | Decision recorded. No sign-in implementation and no users |
| Authorization / RBAC | Roles and permission names are written in the PRD and architecture overview. Nothing enforces them here |
| Existing users | None |
| Organizations / clients | No store. The PRD says an organization is the tenant. Alamo Tech LLC is the product owner, and Tenant Zero in the control plane |
| Navigation | None |
| Dashboards | None. The PRD roadmap lists a dashboard and a RaaS module. Neither exists |
| APIs | None in this repository |
| API clients | None |
| Backend services | None |
| GoHighLevel | Not integrated here. Public GoHighLevel forms and the booking embed stay on the marketing site |
| n8n | Not integrated here. Public contact and get-started forms post to n8n from the marketing site |
| AlamoOS | This repo is an AlamoOS project (`workflow_id` `bootstrap`, manifest phase `complete`, cursor file still `plan` / `running`). No customer-facing AlamoOS API |
| Secret Manager | No client and no secrets in git. `.env` is gitignored |
| Cloud Storage | None |
| Logging | No application logger |
| Monitoring | No application metrics or alerts |
| Environment configuration | DEV and MAIN are required on paper. Neither environment exists. DEV must not use production data |
| Deployment process | None. Future production host `https://app.alamotechllc.com` is not provisioned. The security review is QUICK, status `NOT_APPLICABLE`, gate `DEVELOPMENT` |
| Tests | No test suite |

Capability packs bound on the manifest: TypeScript 1.0.0 (strict mode) and architecture 1.0.0. There is no `tsconfig.json` yet.

The draft PRD (`docs/prd/PRD-001.md`) says the first customer-platform milestone is a shell: authentication, organization, RBAC, dashboard shell, and a RaaS module shell. That PRD is still draft. This audit's Milestone 1 is the narrower Lead Capture path in `MILESTONE-1-PLAN.md`.

---

## Environments that already exist elsewhere

These are not this application's DEV or MAIN. They explain which identities must stay separate.

| System | DEV | Production | Data plane |
| --- | --- | --- | --- |
| Marketing site `at-alamotechllc-website` | Branch `dev`, `https://dev.alamotechllc.com`, DreamHost rsync | Branch `main`, `https://alamotechllc.com`, DreamHost rsync | Static Vite build. No operational Firestore |
| RaaS control plane | Firebase emulators only. Project id `demo-raas-cp` is an emulator id, not a cloud project | Not deployed. Proposed name `raas-cp-prod` is not created | Admin SDK against the emulator |
| This web application | Not created. Must not be `dev.alamotechllc.com` | Not created. Future host `app.alamotechllc.com` | None |

Proposed control-plane cloud names, still uncreated, are in `raas-control-plane/docs/deployment.md`: GCP project `raas-cp-dev`, Firestore Enterprise in `us-central1`, Cloud Run services `raas-api`, `raas-ingress`, and `ghl-adapter`. Region must be confirmed before any database is created. This audit does not create or rename those projects.

The marketing GitHub workflow injects `VITE_FIREBASE_*` secrets at build time. `src/config/env.ts` does not read them. The approved technology decision says those values belong to a different unused client configuration and must not become the RaaS project. The project id is stored as a GitHub secret and is not recorded in the repository. It was not retrieved.

---

## Control plane already built

`raas-control-plane` (GitHub `alamotechllc/raas-control-plane`) is a private npm workspace on Node.js 22. It is the only running Lead Capture implementation. It is local and emulator-only. Its own milestone note says to stop for review before Milestone 2.

| Path | Role |
| --- | --- |
| `packages/domain` | Ids, canonical hash, GoHighLevel mapping, result math, Tenant Zero constants |
| `packages/auth` | Local adapter JWT (HS256) used when Google OIDC is not configured |
| `packages/logging` | Structured JSON logs and a PII denylist |
| `packages/store` | Firebase Admin init, authorization, ingest, results query, file or memory secrets and receipts |
| `services/raas-api` | Hono API. Verifies Firebase ID tokens with the Admin SDK |
| `services/raas-ingress` | Hono ingress. Verifies the adapter token, resolves the binding, writes the event |
| `services/ghl-adapter` | GoHighLevel calendar webhook mapper |
| `firestore.rules` | `allow read, write: if false` for every document |
| `storage.rules` | `allow read, write: if false` for every object |
| `firebase.json` | Auth emulator `127.0.0.1:9099`, Firestore emulator `127.0.0.1:8080`. No Hosting, Functions, or deployed project |
| `.github/workflows/ci.yml` | Node 22, JDK 17, `npm ci`, typecheck, lint, unit tests, emulator tests |

Tenant Zero constants in `packages/domain/src/tenantZero.ts`:

| Field | Value |
| --- | --- |
| Tenant | `ten_01ARZ3NDEKTSV4RRFFQ69G5FAV`, legal name Alamo Tech LLC, timezone `America/Chicago` |
| Service instance | `ins_01BRZ3NDEKTSV4RRFFQ69G5FAB`, product `lead-capture` |
| Provider account fixture | `loc_tenant_zero_fixture`, provider `gohighlevel` |
| Metric policy | `lead-capture-metrics-v1` |

`scripts/seed-tenant-zero.ts` writes `raasProducts/lead-capture`, the tenant, and the active service instance. It does not write a provider binding. The binding is created through `POST /v1/tenants/{tenantId}/provider-bindings`.

Ports in `.env.example`: API `8091`, ingress `8092`, adapter `8093`. `OIDC_MODE=local`. Secret and receipt stores default to files under `.local/`.

### Routes the emulator slice actually serves

`raas-api`:

- `GET /healthz`
- `POST /v1/tenants/{tenantId}/provider-bindings` (GoHighLevel `calendar` only in this slice)
- `GET /v1/tenants/{tenantId}/provider-bindings`
- `GET /v1/tenants/{tenantId}/events`
- `GET /v1/tenants/{tenantId}/appointments`
- `GET /v1/tenants/{tenantId}/leads`
- `GET /v1/tenants/{tenantId}/results`

`raas-ingress`:

- `GET /v1/ingress/bindings:resolve`
- `POST /v1/ingress/events`

`ghl-adapter`:

- `POST /webhooks/gohighlevel/{externalAccountId}`

Human calls present a Firebase ID token. The API reads `raasRole` and `tenantId` from that token, then loads membership or operator assignment from Firestore. Adapter calls use a local JWT whose email must be the allowlisted GoHighLevel adapter identity. Ingress resolves `providerBindingIndex` and rejects a body tenant that does not match the binding.

`GET /results` runs `computeLeadCaptureResults` in process. It does not write `resultSnapshots`. The daily snapshot job and Cloud Scheduler are specified and not implemented. Pub/Sub is not used. That matches the technology decision: add Pub/Sub only when a request cannot finish the work.

Firestore writes in this slice use the Admin SDK. The client rules deny every caller, including a signed-in user. The Admin SDK does not evaluate those rules, so API authorization tests carry that load. `tests/emulator/rules.test.ts` and `tests/emulator/milestone1.test.ts` cover the slice. Unit tests cover domain math, local JWT behavior, and redaction.

### Slice limits already recorded by the control plane

These are implementation limits. They are not edits to the approved contracts.

| Limit | Current behavior |
| --- | --- |
| Event catalog | Only `AppointmentBooked` is ingested. Other catalog types return `422 EVENT_TYPE_NOT_IN_MILESTONE` |
| Provider signature | Fixture HMAC-SHA256 in `X-Provider-Signature`. Live GoHighLevel's signature scheme is unconfirmed |
| Adapter identity | Local HS256 JWT. Production Google OIDC is the contract. Google mode fails closed |
| Receipts and secrets | File or memory stores. Secret Manager and Cloud Storage are the production bindings and are not called |
| Result snapshots, reconciliation, retention, public lead API | Not implemented |
| Deploy | Dockerfiles exist. Nothing is published. `gcloud` and `firebase deploy` are out of the current milestone |

---

## Marketing site boundary

`at-alamotechllc-website` is Vite, React 18, TypeScript, React Router, Tailwind, and shadcn/ui. It deploys to DreamHost. It has no `firebase` dependency in application source.

Public RaaS stays at `/raas` (sell / explain). Customer RaaS is specified at the future `app.alamotechllc.com/raas` (operate / report / deliver).

GoHighLevel on that site is an embedded form and calendar for acquisition. n8n on that site receives public contact and get-started JSON posts at `n8n.alamotechllc.net`. Those webhooks are marketing intake. They are not the RaaS provider adapter and they must not become a second writer of `businessEvents`.

The default `VITE_API_BASE_URL` in the marketing env module is `https://api.alamotech.com`. That host is not the approved RaaS API. Approved contracts forbid `api.raas.alamotechllc.com`, `app.raas.alamotechllc.com`, `dashboard.raas.alamotechllc.com`, and `results.raas.alamotechllc.com`.

---

## Domain concepts

Use the control-plane names. The customer PRD uses a few display synonyms. Milestone 1 must not create a second collection for a synonym.

| Concept | Where it already exists | Milestone 1 rule |
| --- | --- | --- |
| Tenant | `tenants/{tenantId}` with `legalName`. Tenant Zero is Alamo Tech LLC | Reuse this document |
| Organization | PRD and architecture: an organization is the tenant. No `organizations` collection | UI copy may say organization. The id remains `tenantId` |
| Client | Domain text: the RaaS client is the tenant. AlamoOS "client" is a portfolio record. Marketing copy says client | Do not add a Client collection |
| Contact | Marketing contact form and n8n webhook | Stays on the marketing site. A RaaS person is a lead, not a contact record |
| Lead | `tenants/{tenantId}/leads/{leadId}` | Reuse. `AppointmentBooked` can create the lead |
| Campaign | `tenants/{tenantId}/campaigns/{campaignId}` in the domain model | Reuse when a campaign is needed. Tenant Zero seed has no campaign. A null campaign is valid on the event |
| Appointment | `tenants/{tenantId}/appointments/{appointmentId}` | Reuse |
| Service | `raasProducts/lead-capture` is the only MVP product. The PRD also lists a future platform Services module | The RaaS product is `lead-capture`. The platform Services module is outside Milestone 1 |
| ServiceInstance | `tenants/{tenantId}/serviceInstances/{instanceId}` | Reuse the seeded Lead Capture instance. The model allows one active Lead Capture instance per tenant |
| Integration | This repo's integration requirements name RaaS, MailGuard, and AlamoOS as boundaries | The RaaS integration object is `providerBindings` |
| Provider | `gohighlevel` on the binding and on `source.provider` | Reuse. Business event type stays `AppointmentBooked` |
| Webhook | Adapter route `/webhooks/gohighlevel/{externalAccountId}`. Separate n8n webhooks on the marketing site | RaaS webhooks enter through the adapter. n8n stays on the marketing site |
| Event | `businessEvents` | Reuse. Do not add a generic events collection beside it |
| AuditEvent | `auditEvents`. Binding create already writes `binding.create` | Reuse |
| Result | Computed by `computeLeadCaptureResults`. `resultSnapshots` is specified and not written by the current GET | The dashboard reads `GET /results`. Do not add a parallel results collection |
| Metric | `lead-capture-metrics-v1` and `metricPolicy` on the service instance | Reuse |
| User | Firebase Authentication uid. Contract also specifies `users/{uid}` | Identity is the Firebase uid. The current seed does not write `users/{uid}`. Authorization reads claims plus `members` or `operators` |
| Role | API roles: `platform_admin`, `operator`, `tenant_admin`, `tenant_viewer` | Reuse these four. The PRD name `platform_operator` means `operator` |
| Permission | PRD names such as `raas.view` and `raas.manage` | The API enforces roles, not those permission strings. Milestone 1 does not add a second permission engine |

`tenant_user` appears in the customer PRD and does not appear in the security-model matrix. It is not a fifth control-plane role until the product owner maps it.

---

## Security boundary

The required browser path is:

```text
Browser
  → Firebase Authentication
  → Firebase ID token
  → trusted API
  → RBAC and tenant authorization
  → Firebase Admin SDK
  → Firestore
```

The required provider path is:

```text
Provider
  → provider adapter
  → Google service identity / OIDC
  → RaaS ingress
  → binding resolution
  → business event
  → Firestore
```

The emulator slice follows that shape with two stand-ins: the Auth emulator, and a local adapter JWT in place of Google OIDC. Firestore client rules already deny every document. Storage rules already deny every object.

These operational categories stay on the server side of the API. The current rules deny the whole database, which covers them:

- `businessEvents`
- `providerBindings` and `providerBindingIndex`
- provider receipts
- `auditEvents`
- `deadLetters`
- reconciliation documents
- integration secrets
- raw webhook payloads
- recordings

The browser in Milestone 1 is an API client. It does not receive the Firestore client SDK, a service account, or `secretValue`.

### Security blockers

| Blocker | Why it blocks a real environment |
| --- | --- |
| No Firebase/GCP project for this application or for RaaS | Auth, Firestore, Secret Manager, and Cloud Run have nowhere to live. Creating one is a separate approval |
| Marketing `VITE_FIREBASE_*` secrets | Approved decision says they are a different unused configuration. Reusing them would attach operational data to the public site's build |
| Local adapter JWT | Acceptable for emulators and CI. A deployed ingress that accepts the shared HMAC secret would weaken the approved OIDC rule |
| Live GoHighLevel signature | Unconfirmed. The adapter must not be exposed to the public internet on a fixture HMAC |
| Public base URL disagreement | The copied API contract names `alamotechllc.com/api/raas`. ADR 14 leaves DreamHost proxy and apex move unapproved. The dashboard cannot call that URL today |
| `tenant_user` and PRD permission strings | Unmapped to the API. Shipping them as a second check would fork authorization |
| App Check | Required by this application's architecture overview before a production client calls a Firebase-backed API. Not configured. The security model says App Check is not required on `raas-api` while Cloud Run invoker IAM excludes the public. Those two sentences need one ruling before production |
| Admin SDK bypasses rules | A bug in `raas-api` is not stopped by `firestore.rules`. Emulator authorization tests have to stay in CI |

---

## Architecture conflicts

1. **One repository versus the approved split.** Product decision 12 prefers one repository when the current architecture can support it cleanly. Product decision 13 forbids creating another repository without approval. `raas-control-plane` already exists and was an approved create. ADR 14, the migration manifest (`INTEGRATE`, not `MIGRATE`), `docs/architecture/integrations.md`, and the later text of specification `06` say the service code stays there. This empty web application can host a dashboard cleanly. It cannot absorb Cloud Run services without contradicting those records. Recommendation and the decision request are in `REPOSITORY-ARCHITECTURE.md`.

2. **API front door.** Specification `10` in this folder publishes the API on the marketing apex. The control-plane snapshot publishes it on a Cloud Run origin. ADR 14 says the customer UI moves here and does not approve an edge in front of Cloud Run. Milestone 1 local work uses `http://127.0.0.1:8091`. A deployed origin is undecided.

3. **Customer DEV/MAIN versus `raas-cp-dev` / `raas-cp-prod`.** This application requires its own DEV and MAIN. The control plane proposes two different project names. Nobody has decided whether the dashboard and the control plane share one Firebase project per environment. They should share Authentication and Firestore per environment so one ID token matches one user store. They should not share the marketing site's DreamHost lifecycle or its unused Firebase secrets.

4. **PRD milestone versus Lead Capture milestone.** The draft PRD's first milestone is a whole platform shell, including MailGuard and AlamoOS boundaries. The approved RaaS Milestone 1 is only the Lead Capture path through the Alamo Tech dashboard. The plan follows the RaaS path. MailGuard, Web Exposure, Assessments, and the platform Services module stay out.

5. **Cursor phase file.** `alamo.manifest` records bootstrap workflow phase `complete`. `.alamo/workflows/active.json` still says `current_phase` `plan` and `status` `running`. This audit does not move that cursor.

---

## What this audit did not do

- No application source, Firebase config, or dashboard.
- No edit to the seven approved contracts.
- No cloud project create, rename, or deploy.
- No DNS change.
- No move of `raas-control-plane`.
- No live GoHighLevel call and no production credential use.
