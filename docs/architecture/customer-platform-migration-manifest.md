# Customer platform migration manifest

**Canonical copy:** `App_Projects/at-alamotechllc-webapp/docs/architecture/customer-platform-migration-manifest.md`  
**Shared copy:** `App_Projects/at-alamotechllc-website/docs/raas/customer-platform-migration-manifest.md`  
**Date:** 2026-10-23

Update both copies together. This file is canonical.

Nothing in this manifest has been moved. Strategies name the destination. They are not a work order to copy code.

| Source | Item | Classification | Destination | Strategy | Dependencies |
|---|---|---|---|---|---|
| `at-alamotechllc-website` | `/`, `/services`, `/booking`, `/get-started`, `/contact`, and other public marketing routes | MARKETING | `at-alamotechllc-website` | KEEP | DreamHost `dev` / `main` deploy |
| `at-alamotechllc-website` | `/raas` sales page (`src/pages/Raas.tsx`) | MARKETING | `at-alamotechllc-website` | KEEP | Public RaaS stays sell/explain |
| `at-alamotechllc-website` | GA4, sitemap, structured data, `robots.txt` | MARKETING | `at-alamotechllc-website` | KEEP | Measurement id stays on the marketing site |
| `at-alamotechllc-website` | n8n form posts, GoHighLevel forms and booking embed | INTEGRATION | `at-alamotechllc-website` | KEEP | Customer app does not take over public lead forms in this milestone |
| `at-alamotechllc-website` | Brand tokens, logos, shadcn UI (`src/index.css`, `tailwind.config.ts`, `public/assets/`) | SHARED | `at-alamotechllc-webapp`, by a later copy | REUSE | No shared package and no monorepo |
| `at-alamotechllc-website` | Unused `VITE_FIREBASE_*` deploy values and unused `api.alamotech.com` default | UNDETERMINED | Neither application bundle | REVIEW | Do not add Firebase to the Vite bundle |
| `at-alamotechllc-website` | Reserved customer paths `/raas/dashboard`, `/raas/assessments`, `/raas/results/:id`, `/raas/reports` | CUSTOMER_APPLICATION | `at-alamotechllc-webapp` | REIMPLEMENT | Not present as routes today. Do not add them to the marketing site |
| `raas-control-plane` | Tenants, events, results API, RBAC, Firestore deny-all rules | INTERNAL | Stays in `raas-control-plane` | INTEGRATE | Firebase Auth model; no production deploy yet |
| `raas-control-plane` | GoHighLevel adapter | INTEGRATION | Stays in `raas-control-plane` | INTEGRATE | Local emulator only |
| `raas-control-plane` | Client reporting UI (not built) | CUSTOMER_APPLICATION | `at-alamotechllc-webapp` | REIMPLEMENT | Separate milestone. Do not merge into the marketing site |
| `at-domainmail-webapp` | Scanner engine, operator console, scan stores | INTERNAL | `at-domainmail-webapp` | KEEP | Independent service |
| `at-domainmail-webapp` | Customer-visible scan fields | CUSTOMER_APPLICATION | `at-alamotechllc-webapp` | INTEGRATE | API contract is unknown. Do not invent endpoints |
| AlamoOS | Projects, agents, findings, credentials, internal notes | INTERNAL | AlamoOS | KEEP | Never exposed to the customer app |
| AlamoOS | Customer-safe status, once a contract names the fields | INTEGRATION | `at-alamotechllc-webapp` | INTEGRATE | Customer-safe contract only. No direct database access |

## Strategies

| Strategy | Meaning here |
|---|---|
| KEEP | Stays where it is |
| MIGRATE | Move the existing implementation. Not chosen for any row. A move would blur the security boundary. |
| REUSE | Use the same asset from a copy, without a shared runtime package |
| REIMPLEMENT | Build the customer-facing behavior in `at-alamotechllc-webapp` when a milestone approves it |
| INTEGRATE | Call the owning system through a reviewed contract |
| REVIEW | Decide later. Do not wire it now |
