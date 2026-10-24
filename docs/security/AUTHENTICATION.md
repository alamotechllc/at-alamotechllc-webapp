# Authentication

Google sign-in proves who a person is. It does not grant access to the application, a tenant, or any operational record. Authorization is a separate decision, documented in [AUTHORIZATION.md](AUTHORIZATION.md).

## Flow

1. The browser signs in with Google through Firebase Authentication.
2. Firebase returns an ID token.
3. The browser reads the caller's own authorization record in Firestore.
4. Firestore Security Rules allow or deny that read from the stored role, status, and tenant assignment.
5. Later reads of tenant data use the same rules. The token claim is not the grant.

A verified token with no application record returns `403 ACCESS_NOT_AUTHORIZED`. The screen says:

> Access not authorized
>
> Your Google account was authenticated successfully, but it has not been granted access to the Alamo Tech platform.

That response does not include tenant names, roles, or internal identifiers.

## What the browser holds

The web app uses the Firebase web configuration (`apiKey`, `authDomain`, `projectId`). That configuration identifies the Firebase project. It is not an authorization secret and it is not an Admin credential. The Admin SDK stays on trusted server jobs and the bootstrap command.

Local development connects to the Auth emulator when `VITE_USE_FIREBASE_EMULATORS` is not `false`. The emulator form accepts the seeded password account. A release build hides that form and requires the web configuration. Google is the primary action: **Continue with Google**. The `hd=alamotechllc.com` parameter only asks Google's account picker to prefer the Workspace domain. The API still checks the domain before any staff role is accepted.

## Session behavior

| State | What the person sees |
| --- | --- |
| Checking | "Checking sign-in" or "Checking access" |
| No Firebase user | Redirect to `/sign-in` |
| Google or emulator sign-in failed | "Authentication failed." The raw Firebase code stays off the page |
| Token verified, no grant | "Access not authorized" |
| Server record disabled | "Account disabled" |
| Token refresh still rejected | "Session expired" |
| Firestore did not respond | "We couldn't confirm access". This is not treated as a denial |

After sign-in, the browser reads the caller's authorization document. An active matching record opens the app. The UI does not read `raasRole` from the ID token to decide access. Sign-out clears the Firebase session. Restoring the page asks Firebase for the current user and then reads the authorization document again.

## Staff domain

`platform_admin` and `operator` are eligible only for the hosted domain `alamotechllc.com` (`OPERATOR_HOSTED_DOMAIN` overrides the check). Eligibility is not a role. `user@alamotechllc.com` with no `platformAdmins` or `operators` record is denied.

On the Auth emulator, `@alamotechllc.test` is the local stand-in for that eligibility check. It is not a production grant. Outside the emulator, a staff principal must have signed in with the Google provider. A custom token or a password user is not staff in production. An `hd` claim that is not the Workspace domain is denied even when the email domain looks right.

Customer roles (`tenant_admin`, `tenant_viewer`) may use any Google account. They still need an active membership.

## Local users

`npm run seed:operator` creates `operator@alamotechllc.test` on the emulator only. The password is `local-dev-only` in `.env.example`. That command writes `operators/{uid}` and the Tenant Zero assignment. It does not make the account a platform admin.

The first platform admin is [ADMIN-BOOTSTRAP.md](ADMIN-BOOTSTRAP.md). The first person to sign in does not become an admin.
