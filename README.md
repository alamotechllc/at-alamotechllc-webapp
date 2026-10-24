# Alamo Tech Customer Application

Authenticated Alamo Tech customer platform.

| | |
|---|---|
| Project ID | `at-customer-webapp` |
| Filesystem | `at-alamotechllc-webapp` |
| Display name | Alamo Tech Customer Application |
| Alias | `at-web-app` |
| Future hostname | https://app.alamotechllc.com |
| Hostname status | Not provisioned. Do not create production DNS from this repository. |

This repository is the customer application. It is not the public marketing site and it is not AlamoOS.

- Marketing site: `at-alamotechllc-website` at https://alamotechllc.com and https://dev.alamotechllc.com
- Public RaaS (sell / explain): https://alamotechllc.com/raas
- Customer RaaS (operate / report / deliver): https://app.alamotechllc.com/raas when this application is deployed
- RaaS in this repository: local emulators, `raas-api`, `raas-ingress`, and the GoHighLevel appointment adapter. The earlier slice remains in `raas-control-plane`
- MailGuard: `at-domainmail-webapp`

The product name is **Alamo Tech Customer Platform**. RaaS is one module inside that platform.

## What is here

Registration, the draft PRD, the architecture boundary, and the Milestone 1 Lead Capture stack. Local `raas-api`, `raas-ingress`, the GoHighLevel adapter, and the operator screens in `apps/web` run against Firebase emulators. No cloud project or production deploy is configured.

```bash
npm ci
./scripts/build.sh
./scripts/test.sh
```

Emulator ports are Firestore `8280`, Auth `9198`, and Storage `9399`. See `docs/raas/MILESTONE-1-STATUS.md`.

## Documents

- `docs/prd/PRD-001.md` — draft PRD
- `docs/architecture/overview.md` — platform architecture
- `docs/architecture/customer-platform-migration-manifest.md` — canonical migration manifest
- `docs/architecture/integrations.md` — MailGuard and AlamoOS contracts
- `docs/security/requirements.md` — security requirements
- `docs/deployment/requirements.md` — environment requirements
- `docs/service-relationship.md` — `ACTIVE_PROJECT`, approved 2026-10-23, Lead Capture RaaS MVP
- `docs/raas/` — approved contracts `06`–`12`, the audit, the Milestone 1 plan, and `MILESTONE-1-STATUS.md`
- `PROJECT-STATUS.md` — human status. The execution cursor is `.alamo/workflows/active.json`

## Related

The same migration manifest is copied to `at-alamotechllc-website` at `docs/raas/customer-platform-migration-manifest.md`. This file is the canonical copy. Update both together.
