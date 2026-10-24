# Security requirements — Alamo Tech Customer Application

**Project ID:** `at-customer-webapp`  
**Date:** 2026-10-23  
**Status:** Requirements. Not a completed security review.

These requirements apply because the application will hold customer data. They are the AlamoOS Web Application Security Baseline topics for this project. The baseline engine writes the review. This file does not mark any control as passed.

| Topic | Requirement |
|---|---|
| Authentication | Firebase Authentication as decided in `docs/architecture/overview.md`. Verify ID tokens on the server with the Admin SDK. No anonymous sign-in. |
| Authorization | Enforce roles and permissions on the server. UI hiding is not authorization. |
| Tenant isolation | Every customer-owned object is scoped to an organization. A caller without membership for that organization gets the same response as a missing object. |
| Secrets | No credentials, API keys, or service-account files in the repository. `.env` is gitignored. |
| Dependency security | When an application manifest exists, lock dependencies and review advisories before DEV deployment. There is no application manifest yet. |
| Runtime versions | Pin the runtime when the application is scaffolded. Do not deploy an unsupported runtime. |
| Secure headers | DEV and MAIN responses set a baseline header policy (frame, content type, referrer, HSTS on HTTPS). |
| API security | Authenticated routes reject missing or invalid tokens. Browser clients do not call AlamoOS or MailGuard databases. |
| Input validation | Server validates request bodies. Organization id in a body is not an authorization source. |
| Audit logging | Record sign-in, sign-out, denial, role change, and cross-organization access. Do not log secrets, raw webhook bodies, or tokens. |
| Rate limiting | Authentication and public integration ingress have limits before production. Values are set when those routes exist. |
| Data access | Operational RaaS data is reached through the RaaS API. Firestore client access to that data stays denied. |
| Environment separation | DEV and MAIN use separate identities, data, and backends. DEV does not read production. |
| Dependency lifecycle | Track runtime and major dependency support dates once those dependencies exist. |
| Deployment verification | A deployment is not production-ready while a critical finding is open or a required check is unknown. |

## Registration

This project is in the AlamoOS portfolio and host registry. The security baseline is run with the factory `security-baseline` evaluator. Proposal apply still requires this approved `docs/service-relationship.md`, which is `ACTIVE_PROJECT` and `APPROVED` for the internal Lead Capture RaaS MVP. There is no named-client retainer.

## Current gap

There is no application to scan for headers, auth middleware, or a lockfile. Unknown and not-applicable checks stay unknown. They are not treated as passed.
