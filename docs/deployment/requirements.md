# Deployment requirements — Alamo Tech Customer Application

**Project ID:** `at-customer-webapp`  
**Date:** 2026-10-23  
**Status:** Firestore `(default)` exists in `at-alamotechllc-webapp` at `us-central1`. Client rules are deny-all. `raas-api` is not deployed. The deploy procedure is [deploy.md](../../deploy.md) at the repository root.

The customer application has its own deployment lifecycle. It does not publish through the marketing site's DreamHost workflow (`.github/workflows/deploy.yml` in `at-alamotechllc-website`).

## Channels

| Channel | Application | Authentication | Data | Backend | Hostname |
|---|---|---|---|---|---|
| DEV | This repository's DEV build | DEV Firebase project, when one is approved | DEV only | DEV only | Not chosen. Not `dev.alamotechllc.com` |
| MAIN | This repository's production build | Production Firebase project, when one is approved | Production only | Production only | `app.alamotechllc.com`, not created |

`dev.alamotechllc.com` remains the marketing site's development host.

## Rules

- Do not reuse production data in DEV.
- Do not create production DNS, a production Firebase project, Cloud Run, or a production database in the registration milestone.
- Do not point this application at the marketing site's unused `VITE_FIREBASE_*` values.
- Do not add Firebase to the marketing Vite bundle.
- The operator UI target is Firebase Hosting, gated by `deploy.md` at the repository root. The Firebase project is not created by this repository. Moving `alamotechllc.com` off DreamHost is not part of standing up this app.
- DEV and MAIN use separate secrets, service accounts, and logs.
- Build and test today are `./scripts/build.sh` and `./scripts/test.sh`, which exit 0 because there is no application yet. Replace them when a real build exists. Do not describe the no-op scripts as a deployment.

## Marketing site, unchanged

| Channel | Branch | Hostname |
|---|---|---|
| DEV | `dev` | `https://dev.alamotechllc.com/` |
| MAIN | `main` | `https://alamotechllc.com/` |

Those vhosts keep serving the static marketing site, including `/raas`.
