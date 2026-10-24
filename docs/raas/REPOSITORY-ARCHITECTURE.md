# Repository architecture — private web application and Lead Capture RaaS

**Date:** 2026-10-23  
**Status:** Recommendation. No files were moved and no application tree was created.

## Executive takeaway

Keep Lead Capture services in `raas-control-plane` and build the Alamo Tech RaaS dashboard in this repository. A separate third repository is unnecessary. Folding the control plane into this repository would match the preferred single-repo shape, and it would also contradict the approved split that put that code where it is. That fold waits for an explicit product-owner decision. Until then, this repository stays a customer application and gains only `docs/raas/` plus, when implementation starts, a web app that calls the existing API.

---

## What already exists

| Repository | What it is | Deployable unit today |
| --- | --- | --- |
| `at-alamotechllc-webapp` | Private customer application. Documents and AlamoOS registration only. No remote | None |
| `raas-control-plane` | npm workspaces: `packages/*`, `services/raas-api`, `services/raas-ingress`, `services/ghl-adapter` | Three local processes plus Firebase emulators. GitHub Actions CI. No cloud deploy |
| `at-alamotechllc-website` | Public Vite marketing site, including `/raas` | DreamHost, branches `dev` and `main` |

The example layout in the product brief is already how the control plane is shaped:

```text
raas-control-plane/
  services/raas-api/
  services/raas-ingress/
  services/ghl-adapter/
  packages/domain/          # domain, events, and result math live together today
  packages/auth/
  packages/logging/
  packages/store/
  firebase.json
  docs/contracts/
```

This web application does not have `apps/`, `services/`, or `packages/`. Creating that tree now, with empty packages, would be a reorganization without a runtime.

---

## Recommendation

**Least disruptive structure:** two repositories that already exist, one new UI root when implementation is approved.

```text
at-alamotechllc-webapp/
  apps/web/                 # future authenticated dashboard only
  docs/raas/                # contracts 06–12, this audit, this plan
  firebase/                 # future Hosting config for the dashboard, when a project exists
  scripts/                  # replace the no-op build and test when apps/web exists

raas-control-plane/         # unchanged home of the API, ingress, and adapter
  services/
  packages/
  firebase.json             # emulators, Firestore rules, Storage rules
```

Reasons this fits the current architecture:

- The marketing site and the operational datastore stay apart. The rejected monorepo was a monorepo with the public Vite app. This recommendation does not put `firebase-admin` in that app.
- Service code, emulator tests, and CI already pass in `raas-control-plane`. Moving them creates a second copy during the move.
- The migration manifest classifies control-plane code as `INTEGRATE` and the client reporting UI as `REIMPLEMENT` in this repository.
- Specification `06`, ADR 14, and `docs/architecture/integrations.md` already say the services stay in `raas-control-plane`.
- Product decision 13 is satisfied: no new repository is created. `raas-control-plane` was created under an earlier approval.

The dashboard and the API remain independently deployable. The dashboard build does not ship the Admin SDK. The Cloud Run services do not ship the React bundle.

### What `apps/web` is responsible for

- Firebase Authentication in the browser (sign-in only).
- Calling `raas-api` with the Firebase ID token.
- Rendering Tenant Zero Lead Capture status and results for an authorized user.
- Brand tokens copied from the marketing site when the UI is built. The architecture overview forbids a shared runtime package with that site.

### What `apps/web` does not own

- Firestore reads or writes of operational collections.
- Provider secrets, raw webhook bodies, or receipt bytes.
- GoHighLevel signature verification.
- Business-event validation and result formulas. Those stay in `@raas/domain` so the dashboard cannot drift from the API.

---

## If the product owner later approves one repository

The clean destination is this private application, not the marketing site. The move is a relocation of the existing workspace, with package names kept, followed by retiring the old remote as the source of truth. Empty placeholder packages should not be created first.

```text
at-alamotechllc-webapp/
  apps/web/
  services/raas-api/
  services/raas-ingress/
  services/ghl-adapter/
  packages/domain/          # keep events and results here until a split has a caller
  packages/auth/
  packages/logging/
  packages/store/
  firebase/                 # emulators and rules, moved with the services
  docs/raas/
```

`packages/raas-events` and `packages/raas-results` are not justified yet. Event ids, the catalog, and `computeLeadCaptureResults` are one domain package with one test suite. Splitting them before a second consumer exists is the reorganization this review declines.

Do that move only after approval, in one change, with CI green on the new tree and the old repository marked as the historical location. Do not leave two writable copies of `@raas/domain`.

---

## Deploy boundaries

| Component | Process | Identity | Data |
| --- | --- | --- | --- |
| Dashboard | Static web app. Preferred host is Firebase Hosting, because there is no Next.js app and App Hosting is not in the current architecture. Hosting is still an open decision | Firebase Auth user | ID token only. No service account in the bundle |
| `raas-api` | Cloud Run when a project is approved. Local port 8091 until then | Runtime service account plus verified ID token | Admin SDK |
| `raas-ingress` | Cloud Run. Local port 8092 | Invoked by the adapter service account | Admin SDK |
| `ghl-adapter` | Cloud Run. Local port 8093 | Google OIDC toward ingress in a real environment. Local JWT only on emulators | Secret read for the binding. No Firestore client |

Firebase Hosting is the recommendation that matches "Firebase Hosting or App Hosting according to the existing architecture." The existing architecture has neither, and `docs/deployment/requirements.md` still says the platform is not selected. DreamHost stays the marketing site's host. App Hosting waits until there is an application model that needs it.

DEV and MAIN for the private application are separate Firebase/GCP projects from each other and from the marketing site. The control plane's proposed names are `raas-cp-dev` and `raas-cp-prod`. Whether the dashboard Hosting site lives in that same project is part of the decision below. One project per environment keeps one Auth user pool and one Firestore database. Two projects per environment would require a second user store and a token audience bridge that the contracts do not define.

Local and CI continue to use emulator project id `demo-raas-cp`. That id is not a cloud project.

---

## Contract copies

`docs/raas/06` through `docs/raas/12` in this repository are a read-only copy of the marketing-site decision record. The control plane still has its own `docs/contracts/` snapshot, and three files differ (see the audit). Until the product owner picks a single source of truth, implementation follows the copy in this `docs/raas/` folder for product rules, and follows `raas-control-plane` for code that already satisfies the emulator slice. Neither copy should be edited to "match the code." A contract change is a separate approval.

Relative links inside the copied files point at marketing-site paths (`13-canonical-namespace-adr.md`, `03-raas-proposed-architecture.md`). Those targets were left unresolved on purpose.

---

## Decisions required before any move or scaffold

| Decision | Recommendation in this document |
| --- | --- |
| Leave services in `raas-control-plane`, or colocate them here | Leave them. Colocate only with an explicit approval |
| Create a third repository for the dashboard | No |
| Put the dashboard in the marketing Vite app | No |
| Firebase Hosting versus App Hosting versus another host | Firebase Hosting for a Vite dashboard, pending the open hosting decision |
| One Firebase project per environment shared by Hosting and Cloud Run | Yes, once project creation is approved. Do not create it in the planning task |
| Split `@raas/domain` into `raas-events` and `raas-results` | No |
