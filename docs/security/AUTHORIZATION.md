# Authorization

Every protected API call re-reads current server state. A Firebase ID token can stay valid for about an hour after a role change, so `request.auth != null` and a custom claim are not enough.

## Pipeline

```text
authenticateRequest
  verifyFirebaseIdToken
  resolvePrincipal
  authorizePermission
  handler
```

`resolvePrincipal` (`packages/store/src/access.ts`) builds the caller:

| Server record | Result |
| --- | --- |
| `platformAdmins/{uid}` status `disabled` | `403 ACCOUNT_DISABLED` |
| `platformAdmins/{uid}` status `active` and staff-eligible | `platform_admin` |
| `platformAdmins/{uid}` status `active` and not staff-eligible | `403 PERMISSION_DENIED` |
| `operators/{uid}` status `disabled` | `403 ACCOUNT_DISABLED` |
| `operators/{uid}` status `active` and staff-eligible | `operator` |
| `operators/{uid}` status `active` and not staff-eligible | `403 PERMISSION_DENIED` |
| Token `tenantId` matches `tenants/{tenantId}/members/{uid}` status `active` and role `tenant_admin` or `tenant_viewer` | That membership role and tenant |
| Membership exists and is not active | `403 ACCOUNT_DISABLED` |
| Anything else | `403 ACCESS_NOT_AUTHORIZED` |

The membership role wins over the claim. The claim's `tenantId` is only the locator, because the API does not run collection-group queries. A token that names tenant B while the membership is on tenant A does not open tenant A.

`authorizePermission` then checks the permission and the tenant:

| Role | Tenant rule |
| --- | --- |
| `platform_admin` | Active `platformAdmins` record and staff eligibility. Cross-tenant reads and writes follow the route permission. The request log records `actorUid`, `tenantId`, and `requestId` |
| `operator` | Active operator record, staff eligibility, and `operators/{uid}/assignments/{tenantId}` |
| `tenant_admin`, `tenant_viewer` | Requested tenant equals the membership tenant, membership is active, and the stored role still matches |

A missing assignment or a tenant mismatch is `403 TENANT_FORBIDDEN`. A role that lacks the permission is `403 PERMISSION_DENIED`. Messages stay generic: "Access is not authorized."

## What is not trusted

The API compares the tenant in the URL with the principal. A tenant id from React state, `localStorage`, the query string, or the request body does not expand access. Changing the claim `raasRole` does not expand access. The browser route guard is only navigation. A direct call to the API gets the same decision.

## Claims

`raasRole` may be `platform_admin`, `operator`, `tenant_admin`, or `tenant_viewer`. A tenant user may also carry `tenantId`. Operator assignments are not copied into the token. `grantPlatformAdmin` sets the claim, revokes refresh tokens, and writes an audit event. Later requests still read Firestore.

## Revocation

Disabling `platformAdmins/{uid}`, `operators/{uid}`, or `tenants/{tenantId}/members/{uid}` fails the next protected request even while the old ID token is still signed. Deleting `operators/{uid}/assignments/{tenantId}` fails the next request for that tenant. Bootstrap revokes refresh tokens after the platform-admin grant so the next sign-in picks up the new claim. The claim is still not the grant.

## Firestore

`firebase/firestore.rules` is `allow read, write: if false` for every document. A signed-in client, including one with a `platform_admin` claim, cannot read operational collections. The browser calls the API. The API uses the Admin SDK, which does not evaluate those rules, so these API tests are the enforcement.

## Audit

Authorization changes go to `platformAudit/{id}` and, when a tenant is involved, `tenants/{tenantId}/auditEvents/{id}`:

`user.role_changed`, `user.disabled`, `user.enabled`, `tenant.member_added`, `tenant.member_removed`, `operator.assignment_added`, `operator.assignment_removed`

Fields: `actorUid`, `targetUid`, `tenantId` when present, `action`, `requestId`, `occurredAt`. Tokens and contact details are not written. `grantPlatformAdmin` writes `user.role_changed`.

There is no Administration → Users API in this phase. The next phase can list users, status, tenant, and assignments, and can disable or change roles by calling the same audit writer. A partial user-management endpoint is not exposed here.

## Frontend

`GET /v1/session` is the only role the UI uses. Navigation shows Overview, Clients, Appointments, Results, and Operations when the server role has the matching read permission. Integrations and Administration are not pages. Hidden links are not a control. Tenant roles request `session.tenantId`. Staff routes in the current UI still open Tenant Zero, because there is no tenant-list API. A pasted tenant id is still decided by the API.
