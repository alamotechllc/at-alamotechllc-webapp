# Architecture — Alamo Tech Customer Platform

**Project ID:** `at-customer-webapp`  
**Date:** 2026-10-23  
**Status:** Platform split remains. The command center runs on Firebase Hosting, Authentication, and Firestore. See [FIREBASE-ARCHITECTURE.md](FIREBASE-ARCHITECTURE.md).

## Responsibilities

| System | Hostname | Responsibility |
|---|---|---|
| Marketing website `at-alamotechllc-website` | `alamotechllc.com`, `dev.alamotechllc.com` | Marketing, SEO, public service pages, `/raas`, lead generation, booking, get-started, contact |
| Customer application `at-alamotechllc-webapp` | `app.alamotechllc.com` (future, not created) | Authentication, organizations, RBAC, customer dashboard, service delivery views |
| RaaS services `raas-control-plane` | None in production | Tenants, events, results, server-side RaaS authorization. Local emulators only |
| MailGuard `at-domainmail-webapp` | None recorded in that README | Scanning engine and operator console |
| AlamoOS | Internal | Projects, agents, orchestration, findings, remediation. Not a customer portal |

```text
Alamo Tech marketing website
            |
            | acquisition / onboarding
            v
       at-alamotechllc-webapp
            |
       +----+----+
       |         |
       v         v
   MailGuard   AlamoOS
```

RaaS services sit behind the customer application. The customer application does not replace them.

## Public RaaS and customer RaaS

| | Public | Customer |
|---|---|---|
| URL | `alamotechllc.com/raas` | `app.alamotechllc.com/raas` |
| Project | `at-alamotechllc-website` | `at-alamotechllc-webapp` |
| Purpose | Sell / explain | Operate / report / deliver |

`/raas` stays on the marketing site. The page that exists today in `src/pages/Raas.tsx` is that sales page.

Lead Capture follows the same split:

| URL | Purpose |
|---|---|
| `alamotechllc.com/raas/lead-capture` | Product sales page, if marketing adds one later |
| `app.alamotechllc.com/raas/lead-capture` | Customer configuration, status, and results |

Same path shape. Different applications. Neither customer route is implemented here.

These names stay forbidden:

```text
api.raas.alamotechllc.com
app.raas.alamotechllc.com
dashboard.raas.alamotechllc.com
results.raas.alamotechllc.com
```

`app.alamotechllc.com` is the customer platform hostname. It is not a RaaS product hostname. Creating the DNS record is a separate approval.

## Multi-tenancy

```text
Platform
    |
    +-- Organization A
    |       +-- Users
    |       +-- Services
    |       +-- RaaS
    |       +-- Reports
    |
    +-- Organization B
            +-- Users
            +-- Services
            +-- RaaS
            +-- Reports
```

Every customer-owned object carries an organization id. Authorization is enforced on the server. The server loads membership for the caller and the organization on the request. It does not trust an organization id in a JSON body. A missing object and an object in another organization both respond as not found. UI visibility is not authorization.

Ordinary command-center reads use Cloud Firestore and Firestore Security Rules. The browser does not call a general-purpose API for those reads. Provider secrets, raw receipts, and audit records stay closed to the client. See [FIREBASE-ARCHITECTURE.md](FIREBASE-ARCHITECTURE.md).

## RBAC

Design authorization before building customer modules.

| Role | Who | Notes |
|---|---|---|
| `platform_admin` | Alamo Tech | Cross-organization. Every tenant read and write is audited. Hosted domain must match the operator domain when that check from `docs/raas/11-mvp-security-model.md` is deployed. |
| `platform_operator` | Alamo Tech | Control-plane role name `operator`. Access only where an assignment exists. |
| `tenant_admin` | Customer | Manage that organization's users and settings. |
| `tenant_user` | Customer | Use granted services. |
| `tenant_viewer` | Customer | Read-only. |

Permissions under those roles:

| Permission | Intent |
|---|---|
| `raas.view` | See RaaS status and results |
| `raas.manage` | Change RaaS configuration the product allows |
| `reports.view` | See customer reports |
| `mailguard.view` | See authorized MailGuard fields |
| `assessments.view` | See assessments when that module exists |
| `organization.manage` | Change the organization profile |
| `users.manage` | Invite, remove, and change members |

A role grants a set of permissions. A module adds permissions later. It does not add a new identity system.

## Authentication

Decision: Firebase Authentication, as specified for RaaS operators and tenant users in `at-alamotechllc-website` `docs/raas/11-mvp-security-model.md`. The marketing site has no authentication to copy.

| Requirement | Decision |
|---|---|
| Identify people | Firebase Authentication. Google for operators. Email link for tenant users who do not have a Google account. Anonymous sign-in disabled. |
| Organization association | Membership document plus a single `tenantId` custom claim for tenant roles. Operators are not given every tenant id in the token. |
| RBAC | Role claim plus permission checks on the server. Membership status is read on each request so a revoked member fails closed before the token expires. |
| Tokens | Firebase Authentication issues the ID token. Firestore rules, and any trusted server job, re-read the role record. The claim is not the grant. Role changes revoke refresh tokens. |
| Logout | Client signs out and the server treats a revoked session as unauthenticated. |
| Account lifecycle | Create, disable, and remove membership. Disabled membership fails closed. |
| Audit | Sign-in, sign-out, denied access, role change, and cross-organization access. |
| Authorized domains | DEV and MAIN domains are separate and are not configured in this change. |
| App Check | Required before a production client calls a Firebase-backed API. Not configured now. |
| Firestore rules | An authorized client may read tenant profile, service, campaign, lead, and appointment records. It cannot read provider secrets or write application data. |

No Firebase project, authorized domain, or App Check app is created by this document.

## Environments

```text
at-alamotechllc-webapp

DEV
   +-- application DEV
   +-- DEV authentication
   +-- DEV data
   +-- DEV backend

MAIN
   +-- app.alamotechllc.com
   +-- production authentication
   +-- production data
   +-- production backend
```

DEV does not use production data, production tokens, or production service accounts. The marketing site's DreamHost vhosts are not the customer application's DEV or MAIN. The command center is hosted on Firebase Hosting. See `deploy.md`.

## Branding

The two applications should look like the same company. They stay separate repositories. There is no shared package.

Reusable inventory from `at-alamotechllc-website` (copy later, do not import the marketing repo):

| Item | Where it lives today |
|---|---|
| Logo, light | `public/assets/alamo-tech-logo-light.png` |
| Logo, dark | `public/assets/alamo-tech-logo-dark.png` |
| Navy | `#0B1F33` (`brand.navy` in `tailwind.config.ts`, theme color in `index.html`) |
| Navy soft | `#123A5A` |
| Steel | `#6E7B87` |
| Accent blue | `#2F6B9A` |
| Accent glow | `#4FA3D9` |
| CSS tokens | `src/index.css` (`--primary: 210 65% 15%`, radius `0.75rem`) |
| UI kit | shadcn/ui under `src/components/ui` |
| Type | Default sans stack. No custom webfont file. |
| Theme storage key | `alamo-tech-theme` |

MailGuard and the control plane do not share this package either.

## Security

Requirements are in `docs/security/requirements.md`. A baseline review is produced by the security-baseline engine. A requirements list is not a passing review.

## Related records

- Canonical migration manifest: `docs/architecture/customer-platform-migration-manifest.md`
- Marketing decision that this record narrows: `at-alamotechllc-website` `docs/raas/14-customer-platform-boundary-adr.md`
- Earlier marketing decision that still forbids `*.raas.alamotechllc.com` and keeps `/raas` on the public site: `docs/raas/13-canonical-namespace-adr.md`
