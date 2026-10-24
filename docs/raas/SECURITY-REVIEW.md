# Milestone 1 security review

**Date:** 2026-10-23  
**Verdict:** PASS WITH FINDINGS  
**Scope:** Lead Capture RaaS in this repository, reviewed against `docs/raas/11-mvp-security-model.md` and the security cases in `docs/raas/12-mvp-test-plan.md`.

The browser cannot read or write operational Firestore. Tenant A cannot read tenant B through the API. Secrets and the raw webhook did not appear in logs or in operator responses after the correction below. Ingress rejects Firebase user tokens. The human API rejects the adapter bearer. Production OIDC, Secret Manager, and receipt storage are not built. Those are residual risks for any later deploy, not holes in the local slice.

## Method

Attempts ran on Firebase emulators for project id `demo-raas-cp`. No cloud project was used. The API and ingress apps were called in process with the same guards as the local servers. A Firebase client SDK, signed in with a `platform_admin` custom claim, attempted Firestore reads and writes against the emulator rules. The existing rules suite also ran. Unit tests, the frontend import guard, typecheck, and lint ran in the same review.

## Explicit attempts

| Attempt | Expected | Observed |
| --- | --- | --- |
| Operator token for tenant A reads tenant B appointments | `403`, no tenant B data | `403`. The body did not contain tenant B's appointment id |
| `tenant_viewer` creates a provider binding | `403 PERMISSION_DENIED` | `403 PERMISSION_DENIED` |
| Firebase ID token calls `POST /v1/ingress/events` | `401` or `403` | `401` |
| Adapter bearer calls `GET /v1/tenants/{tenantId}` | `401` or `403` | `500` before the correction. `401 UNAUTHENTICATED` after it |
| Provider outside the adapter allowlist submits an event | `403` | `403` |
| Body `tenantId` for tenant B with a binding on another tenant | `422 TENANT_MISMATCH`, no write on B | `422 TENANT_MISMATCH`, zero events on B |
| Provider event replay | `200`, no second projection | `200`, `replayed: true`, `appointmentsBooked` stayed `1` |
| Same provider event id, different canonical payload | `409`, original unchanged | `409 IDEMPOTENCY_CONFLICT`, count stayed `1` |
| Binding create response | no `secretValue` | `201`, value absent |
| Operator binding list | `secretPresent`, no `secretResource`, no `secretValue` | Matched |
| Operator replays the admin's binding `Idempotency-Key` | no `secretResource` | `secretResource` was returned before the correction. After the correction the field is removed for every caller who is not `platform_admin` |
| Ingress log of a body carrying email, phone, a name, and `inlineBase64` | values absent | Absent. Ingress copies the envelope and drops the extra fields before logging |
| Adapter log of an unknown-binding webhook that contains a raw marker, email, and phone | values absent | Absent. The log line has provider and request id |
| Signed-in client read of `tenants/{id}/businessEvents` | denied | `permission-denied` |
| Signed-in client write of a business event | denied | `permission-denied` |
| Anonymous and `platform_admin` client SDK reads and writes, including leads and bindings | denied | Denied by `tests/security/rules.test.ts` |
| Unauthenticated Storage upload | denied | Denied by the same rules test |
| Frontend source imports `firebase-admin`, Firestore, Storage, or a backend package | guard fails | No hits. `apps/web/package.json` has no `firebase-admin` and no Secret Manager client |

The signed-in Storage client did not reach the rules evaluator in the extra attempt, because that client had no default bucket configured. The rules file denies every path, and the rules suite denies an unauthenticated upload. A signed-in Storage read was not separately executed.

## Corrections

Both are implementation defects. Neither changes `docs/raas/10` or `docs/raas/11`.

1. `callerFromAuthorization` now turns invalid Firebase ID tokens into `401 UNAUTHENTICATED`. The previous path logged the error name and returned a generic `500`. The token was not in that body. Malformed JSON on the API now returns `400 VALIDATION_FAILED` instead of `500`.
2. Binding create stores the idempotency response, including `secretResource` for a platform admin. Replaying that record returned the stored object without applying the role filter. Operators of the same tenant could learn the secret resource name. The response is filtered when it is returned. The secret payload is still excluded from the hash, the log, the Firestore binding, and the response.

## Controls that hold

| Control | Evidence |
| --- | --- |
| Firebase Authentication for humans | ID tokens are verified with the Admin SDK. Missing credentials are `401`. The browser obtains the token and sends `Authorization: Bearer` |
| RBAC on current routes | `platform_admin` proceeds. `operator` must have an active `operators/{uid}` document and `operators/{uid}/assignments/{tenantId}`. `tenant_viewer` is rejected before a write |
| Tenant isolation | Human routes take `tenantId` from the URL and then authorize. Ingress takes the tenant from the binding index. A disagreeing body tenant is `422` and writes nothing |
| Firestore rules | `allow read, write: if false` for every document. Client denial was executed, including a signed-in platform admin |
| Storage rules | `allow read, write: if false` for every object. Unauthenticated upload was denied |
| Admin SDK boundary | Used by `@raas/store`, `raas-api`, and `raas-ingress`. The GoHighLevel adapter does not depend on it. The web app does not import it |
| Adapter isolation | Vendor JSON is mapped in `services/ghl-adapter`. The stored event attributes are the appointment contract fields. The adapter calls ingress and does not open Firestore |
| Secret handling | `secretValue` goes to `SecretWriter.addVersion` and is removed from the request hash. The binding stores `secretResource`. The API implementation does not call `access`. Local stores are memory and a mode `0600` file under `.local/secrets`. No Google Secret Manager client is called |
| Logging | Structured lines go through `redact` before they are written. Denied keys include authorization, cookies, `secretValue`, `inlineBase64`, email, phone, names, message bodies, recordings, and signed URLs |
| Idempotency | Document id is the event id. Replay writes nothing. Conflict writes a dead letter and does not change the event. A concurrent duplicate left one appointment |
| Frontend data path | Pages call `apiGet` with the ID token. There is no Firestore query in `apps/web` |
| CI | The workflow runs the guard and both test suites and has no deploy job |

## Findings

| Finding | Severity for this milestone | Notes |
| --- | --- | --- |
| One shared local bearer stands in for adapter OIDC | Accepted locally. Blocking for a deploy | Any holder of `LOCAL_INGRESS_TOKEN` may submit any provider on `LOCAL_ADAPTER_PROVIDERS`. The process rejects callers unless `OIDC_MODE=local` and the Firestore emulator are both set |
| Operator and admin tokens are not checked for a hosted domain | Accepted locally | The security model requires `alamotechllc.com` before `platform_admin` or `operator` can be granted. Nothing here grants those claims except the emulator seed |
| Custom claims are set by the seed script | Accepted locally | The model says `raas-api` sets claims after the operator document commits. There is no claim-management route |
| `tenant_viewer` is denied on every current route | Stricter than the model | Membership is not consulted, because `authorizeOperatorAccess` rejects the role first. A future reader route must use `authorizeTenantRead`, which re-reads membership |
| Ordinary tenant reads are application logs, not `auditEvents` | Gap against the model | Binding create does write `binding.create` |
| Receipt bytes are discarded | Gap against the model and the adapter contract | They are not logged. They are also not retained for investigation |
| Redaction matches keys, not free text inside an allowed string | Residual | A phone number placed in `providerEventId` or `message` would be logged. The GoHighLevel mapper uses the appointment id, not a phone |
| `appointmentIndex` is a global document written by the Admin SDK | Low | Nothing reads it. Rules deny the client. A future query must not use it to cross tenants |
| Binding writes are not one transaction | Low | The secret is stored before the binding document. A failed binding write can leave a secret version with no active binding |
| Rate limits, App Check, and log-based alerts are absent | Accepted while nothing is deployed | Required before a public or production route |
| Idempotency records keep `secretResource` | Low after the response filter | The binding document already stores that name. Operators have no route that returns the idempotency document |
| Transitive `npm audit` findings and the Java 21 emulator warning | Known, not fixed in this review | Application code does not ship the Firebase tooling to the browser |

## Dependency boundary

| Package | May use |
| --- | --- |
| `apps/web` | `firebase/app`, `firebase/auth`, the HTTP API |
| `services/ghl-adapter` | Domain types, logging, the secret reader, HTTP to ingress |
| `services/raas-api` | Admin SDK, secret writer, auth verification |
| `services/raas-ingress` | Admin SDK, local adapter authentication |
| Marketing site | Unchanged by this work. It is not given a Firebase data client |

The frontend guard fails the build if `apps/web` source mentions `firebase-admin`, `firebase/firestore`, `firebase/storage`, `@raas/store`, `@raas/auth`, `@raas/secrets`, `@raas/api`, `@raas/ingress`, or `@raas/ghl-adapter`.

## Deploy posture

Nothing in this review authorizes a DEV or production Firebase project, a public webhook, or a Cloud Run service. The local ingress token and the emulator operator password in `.env.example` are development values. Production mode for ingress fails closed.
