# Firebase architecture

The command center is a Firebase web app. Ordinary signed-in use does not depend on a separately hosted `raas-api` service.

```text
Firebase Hosting
    |
    +-- Firebase Authentication (Google sign-in)
    |
    +-- Cloud Firestore
    |       |
    |       +-- Firestore Security Rules
    |
    +-- Google Analytics / GA4
    |
    +-- Firebase Functions
            only when a task needs trusted server execution
```

Firebase project: `at-alamotechllc-webapp`.

## Services in use

| Service | Role |
| --- | --- |
| Firebase Hosting | Serves `apps/web/dist`. Preview channel `dev` is the development site. Production Hosting stays behind `deploy.md`. |
| Firebase Authentication | Google sign-in for the command center. The Auth emulator is for local development. |
| Cloud Firestore | Tenant profile, service instance, campaigns, leads, and appointments, plus the caller's authorization record. |
| Firestore Security Rules | Authorization. A signed-in Google user is not enough. |
| Google Analytics | Product usage on production Hosting. See [GOOGLE-ANALYTICS.md](../analytics/GOOGLE-ANALYTICS.md). |
| Cloud Storage | Rules deny every client read and write. Raw provider files stay closed. |

## Authentication

Google sign-in proves identity. The app then reads the caller's own record:

| Record | Role |
| --- | --- |
| `platformAdmins/{uid}` status `active`, staff email matches | `platform_admin` |
| `operators/{uid}` status `active`, staff email matches, plus `assignments/{tenantId}` | `operator` |
| `tenants/{tenantId}/members/{uid}` status `active` | `tenant_admin` or `tenant_viewer` |

Staff roles require `@alamotechllc.com` and the Google provider. `@alamotechllc.test` is the local emulator stand-in. An external Google account can sign in and still has no tenant access until an active membership exists. The session logic lives in `apps/web/src/auth.tsx`.

## Firestore

Rules are in `firebase/firestore.rules`.

| Client access | Paths |
| --- | --- |
| Read when the caller can read that tenant | Tenant profile, `serviceInstances`, `campaigns`, `leads`, `appointments`, `tasks`, `actions` (only when `assignedTo` is `all` or the caller's uid) |
| Read of the caller's own record | `platformAdmins/{uid}`, `operators/{uid}`, assignments, `members/{uid}` |
| No client read or write | `providerBindings`, `businessEvents`, `auditEvents`, `idempotency`, `deadLetters`, `platformAudit`, and every other path |
| Client create | `members/{uid}/actionCompletions/{actionId}` for the signed-in member when the action applies. No client update or delete |
| Client create and update | `tasks` only, for a platform admin, an assigned operator, or a tenant admin. A tenant viewer can read tasks. Tasks cannot be deleted. Leads, appointments, campaigns, tenant profiles, and action definitions stay read-only |

Action Center behavior is documented in `docs/platform/ACTION-CENTER.md`.

`request.auth != null` does not grant a collection. Appointments Booked is counted in the browser from appointments the caller is allowed to read.

## Functions

No Firebase Functions are deployed. The current screens read Firestore directly and do not need a trusted backend.

Use a function later for work that must not run in the browser: provider webhooks, GoHighLevel calls, Secret Manager, custom claims, privileged administration, scheduled reconciliation, and audit-sensitive writes. Do not add a function whose only job is to proxy a Firestore read.

`raas-ingress` and `ghl-adapter` remain in the repository for that provider work. They are local processes. Hosting does not deploy them, and this app does not replace them with Cloud Run.

## Configuration

Public web config is read from the gitignored `.env` at build time:

- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

These values identify the Firebase web app. They are not service-account keys. `.env.example` is the emulator setup and does not carry the production measurement id.

Vite reads the gitignored `.env` at the repository root. Local development uses the Auth and Firestore emulators when `VITE_USE_FIREBASE_EMULATORS=true`, or when the configured project id is empty or starts with `demo-`. A cloud project id in `.env` uses Firebase Authentication and Firestore for that project. A release build sets `VITE_USE_FIREBASE_EMULATORS` to `false`.

## Deployment

`npm run deploy:dev` deploys the Hosting preview channel. It does not deploy Firestore rules, Functions, or Cloud Run. Rules are deployed separately because they apply to the whole project.

The deploy stops if the web config is missing or points at the emulator. It does not require `VITE_API_BASE_URL`. Production Hosting still requires the production phrase in `deploy.md` and a DEV stamp whose smoke result is `pass`.
