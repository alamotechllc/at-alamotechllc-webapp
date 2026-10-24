# Project status — Alamo Tech Customer Application

Human status only. The execution cursor is `.alamo/workflows/active.json` (`workflow_id` `bootstrap`, `current_phase` `plan`, `status` `running`). This file does not move that cursor.

| Field | Value |
|---|---|
| Project ID | `at-customer-webapp` |
| Filesystem | `at-alamotechllc-webapp` |
| Display name | Alamo Tech Customer Application |
| Alias | `at-web-app` |
| Portfolio lifecycle | Greenfield |
| Kernel lifecycle | `active` (BootstrapEngine finalizes a completed bootstrap as `active`; manifest history records `created` → `active` with reason `Bootstrap completed`) |
| Portfolio category | Product |
| Priority | P2 |
| Service relationship | `ACTIVE_PROJECT`, status `APPROVED`, 2026-10-23. Lead Capture RaaS MVP. Record version 2. Internal product development. No retainer and no SLA. |
| Phase | Milestone 1 local stack is tested on emulators, including the operator RaaS screens. No cloud project. |
| Future hostname | `app.alamotechllc.com` (not provisioned) |
| Security review | QUICK baseline 2026-10-23. Status `NOT_APPLICABLE` because there is no application to scan. Gate `DEVELOPMENT`. The recorded future production URL is `https://app.alamotechllc.com` and is not provisioned. |
| Deployment | None. No DEV or MAIN resources exist. |

## Done in this registration

- Host registry entry and `alamo.manifest`
- Draft PRD and architecture, security, deployment, and integration requirements
- Shared migration manifest
- Boundary recorded on the marketing site (ADR 14) and noted on `raas-control-plane`
- Lead Capture RaaS audit and Milestone 1 plan in `docs/raas/`. Approved contracts `06`–`12` copied unchanged
- Milestone 1 local stack: domain models, Tenant Zero emulator seed, GoHighLevel `AppointmentBooked` adapter, tenant-scoped API and ingress, idempotent ingest, deny-all rules, operator RaaS screens, tests, and CI. Status is `docs/raas/MILESTONE-1-STATUS.md`

## Not done

- Live GoHighLevel signature and production webhook
- DEV deployment
- Production DNS, Firebase project, Cloud Run, or any production data
- MailGuard or AlamoOS API implementation

## Related projects

| Project | Relationship |
|---|---|
| `at-alamotechllc-website` | Public marketing site. Acquisition only. Keeps `/raas`. |
| `raas-control-plane` | Earlier Lead Capture emulator slice. Not modified by this foundation. Not a portfolio project. |
| `at-domainmail-webapp` | MailGuard scanner. Integrate later. Do not copy the engine. |
| AlamoOS | Internal operating system. Customer-safe contract only. |
