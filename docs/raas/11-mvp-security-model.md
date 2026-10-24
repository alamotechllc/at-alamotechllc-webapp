# MVP security model

**Status:** Specification. Prototype rules below are not deployed.  
**Date:** 2026-10-23

## Executive takeaway

Firebase Authentication identifies people. Cloud Run IAM identifies adapters and the scheduler. Firestore rules deny every client. Tenant isolation is enforced in the API by resolving the tenant from a binding or a membership, then querying only that tenant’s path. Secrets, recordings, and webhook bodies stay out of logs and out of the marketing site.

---

## Trust boundaries

| Zone | Holds | Reachable from the public internet |
| --- | --- | --- |
| Marketing site | HTML, GA4, public copy | Yes. No operational credentials |
| Public `/api/raas` and `/api/webhooks/raas` | Canonical paths on `alamotechllc.com`. Not a separate hostname. Not routed today | See [13-canonical-namespace-adr.md](./13-canonical-namespace-adr.md) |
| `raas-api` | Configuration and read models | Only with a Firebase token or scheduler OIDC. Cloud Run invoker is not `allUsers` |
| `raas-ingress` | Event writes | Only adapter service accounts |
| Firestore | Operational records | Admin SDK from the two services. Client SDK denied |
| Cloud Storage receipts | Raw provider payloads and recordings | No public ACL. Signed URL after an audited call |
| Secret Manager | Provider credentials | Adapter and break-glass only |

## Firebase Authentication

- Enabled providers for the MVP: Google, and email link for tenant users who do not have a Google account.
- Anonymous sign-in: disabled.
- Operator and platform-admin tokens must include a hosted domain equal to the configured operator domain (expected `alamotechllc.com`, confirmed at project setup). Tokens without that domain cannot be granted `platform_admin` or `operator`.
- Tenant users are not restricted by hosted domain. They must have an active `members` document.
- Custom claims are set only by `raas-api` using the Admin SDK, after the membership or operator document is committed.
- Clients cannot write claims.

### Claims

Keep claims small. Do not put every tenant id into an operator token.

| `raasRole` | Extra claim | Authorization check on each request |
| --- | --- | --- |
| `platform_admin` | none | Allowed. Audit every tenant read and write |
| `operator` | none | `operators/{uid}/assignments/{tenantId}` must exist and operator status is `active` |
| `tenant_admin` | `tenantId` | Path tenant must equal the claim, and membership status is `active` |
| `tenant_viewer` | `tenantId` | Same, read routes only |

Claim refresh: after a role change the API revokes refresh tokens for that uid. Access tokens may live up to one hour. Membership status is still read from Firestore on each request, so a revoked member fails closed even with an old `tenantId` claim.

Adapter and scheduler calls do not use Firebase Auth.

## RBAC matrix

| Action | platform_admin | operator | tenant_admin | tenant_viewer | adapter SA | scheduler SA |
| --- | --- | --- | --- | --- | --- | --- |
| Create tenant | yes | | | | | |
| Read assigned tenant config | yes | yes | yes | yes | | |
| Create binding or instance | yes | yes | | | | |
| Read binding secret resource name | yes | | | | resolve route only | |
| Submit event | | | | | yes | |
| Read leads and results | yes | yes | yes | yes | | |
| Read receipt URL | yes | yes | | | | |
| Merge leads | yes | yes | | | | |
| Read audit | yes | yes | yes, redacted | | | |
| Run jobs | | | | | | yes |

Empty cell means denied.

## Tenant isolation

1. Human routes take `tenantId` from the URL. The server loads the caller’s membership or assignment. It never trusts a tenant id in the JSON body for authorization.
2. Ingress takes `provider` and `providerAccountId`, loads `providerBindingIndex`, and uses that document’s `tenantId`. A body `tenantId` that differs is `422 TENANT_MISMATCH`. A body that omits `tenantId` is correct.
3. Every Firestore read in request code includes the tenant path `tenants/{tenantId}/...`. Repository helpers do not offer a collection-group query in the MVP.
4. List endpoints start at the tenant subcollection. There is no `/v1/leads` that scans all tenants.
5. `NOT_FOUND` is returned when a document is missing or belongs to another tenant, so callers cannot probe ids across tenants.
6. Suspended tenants still authorize reads and reject ingest.

Tests that try tenant A’s token against tenant B’s URL are required. See [12-mvp-test-plan.md](./12-mvp-test-plan.md).

## Prototype Firestore rules

These rules are a prototype for the future `firestore.rules` file. They are not installed on any project. Review them before the database is created. The intended design is that the client SDK cannot read or write operational data even if a Firebase web config leaks. The API uses the Admin SDK, which does not evaluate these rules, so a bug in the API is not stopped by the rules. API tests carry that load. The rules stop a future client SDK from becoming a second door.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for a control plane whose only reader and writer is the Admin SDK on Cloud Run: every client, including a signed-in Firebase user, is denied. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Do not replace this with rules that let `request.auth.token.tenantId` read documents until a later product decision explicitly allows direct client access. That decision would contradict the current approval.

## Storage rules

Same posture. Prototype, not deployed:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Uploads go through signed URLs minted by ingress for a single object path. Downloads go through signed URLs minted by `raas-api` after the RBAC check.

Bucket settings: uniform bucket-level access, public access prevention enforced, no `allUsers` and no `allAuthenticatedUsers`. Location matches the Firestore region.

## Secret Manager

Specified in [09-provider-adapter-contract.md](./09-provider-adapter-contract.md). Additional rules:

- The POST body field `secretValue` is read once, sent to Secret Manager, and dropped. It is excluded from request logging by a denylist, not by a best-effort string replace after the log line is built.
- Error handlers must not include the request body.
- Application Default Credentials on a laptop are not used against production. Production Cloud Run uses its runtime service account.

## Logging and redaction

Structured JSON logs to Cloud Logging. Each line includes `severity`, `requestId`, `tenantId` when known, `eventType`, `eventId`, `bindingId`, `httpStatus`, and `latencyMs`.

Denylist, dropped before the log call:

- `authorization`, `cookie`, `secretValue`, `inlineBase64`
- `email`, `phone`, `fromPhone`, `toPhone`, `fromEmail`, `toEmail`
- `givenName`, `familyName`, `displayName`, `organization`
- message body, email subject, recording URL, signed URL
- raw provider JSON

Allowed identifiers: tenant, instance, campaign, lead, event, binding, provider slug, provider event id. Provider event ids are logged because reconciliation needs them. If a chosen provider uses a raw phone number as its event id, the adapter hashes that id before it becomes `providerEventId` and keeps the phone only in `attributes`, which are not logged.

Cloud Logging retention for the application log bucket: 30 days. Data Access audit logs for Secret Manager and Cloud Storage stay on the platform default and are not copied into the application log.

A log-based metric counts `IDEMPOTENCY_CONFLICT`, ingress `5xx`, and `TENANT_MISMATCH`. An alert fires when ingress `5xx` exceeds five in ten minutes, or when any `TENANT_MISMATCH` occurs.

## Retention

Defaults, stored on the tenant so a contract can override them. These are operational defaults for the spec, not a legal opinion. Confirm them before the first external client.

| Data | Default |
| --- | --- |
| Business events, leads, appointments, qualification | Life of the service instance, plus 24 months after `ended` |
| Audit events | At least 24 months, and not shorter than business events |
| Provider JSON receipts | 90 days |
| Recordings and attachments | 30 days |
| Dead letters | 90 days after `replayed` or `discarded`. Open letters are not auto-deleted |
| Configuration idempotency rows | 24 hours |
| Result snapshots | Same as business events |
| Application logs | 30 days |
| Signed URLs | 5 minutes |

The retention job refuses to delete business events while any receipt or audit event that references them is still inside its own retention, except receipts may expire first by design. Event documents do not contain the receipt body, so deleting a receipt does not require deleting the event.

Closed tenants are read-only until the retention job runs. They are not dropped on the day the contract ends.

## PII handling

Leads store normalized email and phone because deduplication and follow-up require them. That is the operational store, not the log store.

Receipt bodies are available to operators through an audited URL. Tenant viewers see metrics and lead identity in the API and do not receive recording URLs in the MVP.

Exports, when added, are a separate audited route. The MVP has no CSV export. Copying results is a GET the browser already made. A bulk export is a future route with `result.export` audit.

## Rate limiting and abuse

Ingress limits are in the API contract. In addition:

- Firebase App Check is not required on `raas-api` while invoker IAM excludes the public.
- The deferred public lead route requires App Check or a comparable attestation plus IP rate limits before it is deployed.
- Adapter 422 storms: alert when one binding produces more than 20 dead letters in an hour.

## Dependency and supply chain

- Admin SDK and Firebase Auth verifier are dependencies of the control-plane services only.
- Lockfile and CI live in the control-plane repository.
- The marketing repository’s `npm` tree does not gain `firebase` or `firebase-admin`.

## Known residual risks

- Admin SDK bypasses security rules. A missing `tenantId` in a query is a code defect. Tests must fail the build if a repository method queries a collection group.
- One adapter service account covers every binding of that provider. The per-binding signing secret limits forgery. It does not limit a compromised adapter process that is already verifying webhooks for many tenants. Per-tenant adapter identities are the follow-up control.
- Custom claims can be stale for up to an hour. Membership is re-read so revocation is immediate. A claim is never a sole allow.
- Reconciliation pull uses the provider API token in Secret Manager. That token is as powerful as the vendor allows. Prefer read-scoped tokens where the vendor offers them.
