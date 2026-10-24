# Integration requirements

**Project ID:** `at-customer-webapp`  
**Date:** 2026-10-23  
**Status:** Contracts are boundaries. Endpoints are not invented here.

The customer application displays authorized information from other systems. It does not absorb their engines or their databases.

## RaaS control plane

| | |
|---|---|
| System | `raas-control-plane` |
| What it owns | Tenants, events, leads, results, server-side authorization |
| Where the code stays | That repository. Local Firebase emulators only. Not deployed. |
| Relationship | Integrate later. Do not move the code into this repository. |
| Authentication | Firebase ID tokens for people, as in the MVP security model. Adapter calls use service identity, not a user's browser token. |
| Tenant mapping | The API resolves the organization. The browser does not choose a tenant by body field. |
| Customer-visible fields | Whatever the existing read routes already allow for that role. This document adds no fields. |
| Failure | The customer UI shows a failed or empty state. It does not fall back to another tenant's data. |

## MailGuard

MailGuard is `at-domainmail-webapp` (DomainMail Guard, repository `mailhygiene`). It is an independent scanner and operator console.

```text
MailGuard
    |
    | controlled API, not specified yet
    v
at-alamotechllc-webapp
    |
    v
Customer
```

| Topic | Requirement | Known value |
|---|---|---|
| Authentication between services | Server-to-server identity. Not a copied scanner token in the browser. | Unknown |
| Tenant mapping | MailGuard domain or account maps to one organization, checked server-side. | Unknown |
| API contract | No endpoint is part of this milestone. | Unknown |
| Customer-visible fields | Only fields an approved contract lists. Operator notes and scan internals stay out. | Unknown |
| Authorization | `mailguard.view` on the caller's organization. | Permission name only |
| Failure | Customer view shows unavailable. It does not run a local copy of the scanner. | — |

Do not copy the scanning engine into this application.

The marketing site's `/tools/email-security-scan` page is a lead form. It is not this integration.

## AlamoOS

AlamoOS stays internal.

```text
AlamoOS
    |
    | customer-safe API or events, not specified yet
    v
at-alamotechllc-webapp
```

The customer application never connects to the AlamoOS database.

Never send any of the following across this boundary:

- Internal prompts
- Agent internals
- Credentials
- Secrets
- Internal notes
- Privileged infrastructure information
- Internal operational data

| Topic | Requirement | Known value |
|---|---|---|
| Authentication | Service identity on the AlamoOS side. User tokens are not AlamoOS credentials. | Unknown |
| Tenant mapping | An AlamoOS project or client record may relate to one organization. The map is an explicit contract, not a shared database key. | Unknown |
| Customer-visible fields | Status a customer is allowed to see, once a contract names them. | Unknown |
| Authorization | Checked again in this application against the caller's organization. | — |
| Failure | Omit the AlamoOS-sourced panel. Do not show internal errors or stack text. | — |

No AlamoOS route is added by this document.

## Integration framework

When a later milestone builds integrations, each one is a server-side adapter with:

- a named system
- organization scope
- an allowlist of customer-visible fields
- authentication that is not a browser secret
- audit of reads that cross a system boundary
- fail closed on unknown organization or unknown field

Until those contracts exist, the application shell does not call MailGuard or AlamoOS.
