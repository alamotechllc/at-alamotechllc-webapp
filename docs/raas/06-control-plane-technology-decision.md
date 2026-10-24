# Control plane technology decision

**Status:** Approved direction for internal GCP services. Nothing in this document is provisioned.  
**Date:** 2026-10-23  
**Supersedes:** the open cloud choice in [03-raas-proposed-architecture.md](./03-raas-proposed-architecture.md)  
**Superseded in part by:** [13-canonical-namespace-adr.md](./13-canonical-namespace-adr.md). RaaS is not a separate public application, the API base URL is not a Cloud Run hostname, and RaaS does not get its own public subdomain. Cloud Run, Firestore, and the deny-client rule in this document remain the internal design.

## Executive takeaway

Build the internal RaaS services as a new private GCP project using Firebase Authentication, Cloud Run, Firestore Enterprise, Cloud Storage, and Secret Manager. Publish them through this application's existing domain, as decided in [13-canonical-namespace-adr.md](./13-canonical-namespace-adr.md). Do not add Firebase to the Vite application.

---

## Decision

| Concern | Choice |
| --- | --- |
| Platform | Google Cloud Platform and Firebase |
| Human identity | Firebase Authentication |
| API and workers | Cloud Run |
| Operational database | Cloud Firestore, Enterprise edition, new database |
| Restricted artifacts | Cloud Storage |
| Provider credentials | Secret Manager |
| Logs and alerts | Cloud Logging and Cloud Monitoring |
| Schedules | Cloud Scheduler invoking Cloud Run with OIDC |
| Async bus | Pub/Sub is not part of the MVP. Add it only when a worker must buffer work that Cloud Run cannot finish inside the request |

Firestore is accessed with the Admin SDK from Cloud Run only. The public marketing application does not receive a Firebase config for this project.

## GCP project

Create a new GCP/Firebase project for the control plane. Do not reuse the unused `VITE_FIREBASE_*` values in the marketing site’s GitHub Actions workflow. Those values belong to a different, unused client configuration and would put operational data one SDK import away from the public bundle.

| Environment | Project | Purpose |
| --- | --- | --- |
| `raas-cp-dev` | New | Developer testing with emulators and a private dev project |
| `raas-cp-prod` | New | Production. No public Firestore |

Region is fixed at database creation. Recommended default: `us-central1` for Cloud Run, Firestore, and the receipts bucket, so operational data stays in one US region. Confirm the region before the first `databases:create`. It cannot be changed later.

Firestore edition: **Enterprise** for the new database. This specification was written against Enterprise behavior, including the lack of automatic indexes. Uniqueness in the MVP is enforced with deterministic document IDs so the model still holds if a database is created on Standard edition. When the Enterprise database exists, add the unique indexes listed in [07-control-plane-domain-model.md](./07-control-plane-domain-model.md) as a second guard.

No Firestore database was listed or created while writing this specification. There is no control-plane project in this repository.

## Runtime shape

Two Cloud Run services in the MVP. A third stays undesigned-in-code until the marketing site is allowed to call the plane.

| Service | Invokers | Responsibility |
| --- | --- | --- |
| `raas-api` | Firebase Auth users, Cloud Scheduler OIDC | Configuration, queries, results, audit reads, internal jobs |
| `raas-ingress` | Adapter service accounts only (`run.invoker`) | Verify adapter identity, resolve the binding, append events |
| `raas-public` | Deferred | Future rate-limited endpoint for the marketing site. Not deployed in the MVP |

`allUsers` is not granted `run.invoker` on `raas-api` or `raas-ingress`.

One Cloud Run service with route prefixes is easier for a single developer and weaker as a boundary: a misrouted public handler would share the process and service account with ingress. Two services are still a small deploy. Shared domain code lives in one library package inside the control-plane repository, copied into both images.

Pub/Sub and a worker service wait until projection or receipt upload cannot finish in the ingress request. The MVP writes the event, updates projections, and stores the receipt pointer in one Firestore transaction, and uploads the receipt to Cloud Storage before the transaction commits. If the upload fails, the API returns 503 and writes nothing.

## Repository strategy

### Options

| Option | Coupling | Practical for one developer |
| --- | --- | --- |
| A. Standalone control-plane repository, no contract | Low coupling, high drift. The marketing site and the API will diverge | Simple, and unsafe once the site calls the API |
| B. Monorepo with the Vite app and the control plane | Shared CI, shared lockfile, and a short path to importing `firebase` or `firebase-admin` into the marketing bundle | One Cursor window. The failure mode is the decision this review just forbade |
| C. Separate repository whose only link is the versioned API contract | The marketing site depends on HTTPS and the published contract, not on Firestore types | Two folders. Cursor opens the repo that is being changed. AlamoOS keeps the marketing project and the control plane as separate trees |

### Recommendation

**Option C was the repository split used to start Milestone 1.** That code stays in `raas-control-plane`. It is internal service code, not a second public product. Public routes and the dev/main release train are decided in [13-canonical-namespace-adr.md](./13-canonical-namespace-adr.md). Do not add `firebase-admin` to the Vite bundle.

The contract source of truth moves with that repository (`openapi/v1.yaml` generated from the same schemas the server validates). This marketing repository keeps `docs/raas/` as the approved decision record and, after the move, a short pointer to the control-plane contract tag. It does not gain a second copy that can be edited independently.

Why this stays practical:

- MVP work is almost entirely in the control plane. The marketing site does not change until a later phase adds a call to `raas-public`.
- Cursor can use a multi-root workspace on the day both sides change, without sharing a build.
- AlamoOS already treats `at-alamotechllc-website` as its own project. A second project matches the ownership boundary in [service-relationship.md](../service-relationship.md).
- The Soro cron only rebuilds the static site. Public RaaS routes join the existing dev and main workflow, as decided in [13-canonical-namespace-adr.md](./13-canonical-namespace-adr.md). Cloud Run still cannot ship through that rsync until an edge is approved.

Option B is rejected because the approved rule is that this Vite app must not become the operational datastore. A monorepo makes that mistake a pull request away. Option A is rejected because an undocumented private API will be re-specified inside the marketing site the first time a form is wired up.

### What stays in this repository until the new repo exists

The specification under `docs/raas/06` through `docs/raas/12`. No Cloud Run source, no `firebase.json`, and no client SDK.

## MVP product constraint

Only Lead Capture RaaS is modeled as an active product. The product catalog has a single code, `lead-capture`. The schema leaves room for later product codes. No Security, Automation, Compliance, or Technology collections, events, or routes are added.

Measurable outcome the control plane must be able to compute:

Capture, qualify, follow up with, and book inbound opportunities that a client might otherwise lose.

## Related specifications

- Domain and Firestore layout: [07-control-plane-domain-model.md](./07-control-plane-domain-model.md)
- Events: [08-business-event-contract.md](./08-business-event-contract.md)
- Adapters: [09-provider-adapter-contract.md](./09-provider-adapter-contract.md)
- HTTP API: [10-mvp-api-contract.md](./10-mvp-api-contract.md)
- Security: [11-mvp-security-model.md](./11-mvp-security-model.md)
- Tests: [12-mvp-test-plan.md](./12-mvp-test-plan.md)
