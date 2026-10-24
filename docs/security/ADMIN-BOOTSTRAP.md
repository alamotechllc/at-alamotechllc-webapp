# Platform admin bootstrap

The first `platform_admin` is an intentional command. Signing in does not create the role. An `@alamotechllc.com` address does not create the role.

## Production

1. The person signs in once with Google on the deployed app. That sign-in verifies identity and shows **Access not authorized**.
2. An operator with Admin SDK credentials for the Firebase project runs:

```bash
BOOTSTRAP_PHRASE='AUTHORIZE PLATFORM ADMIN BOOTSTRAP' \
FIREBASE_PROJECT_ID='at-alamotechllc-webapp' \
npm run bootstrap:platform-admin -- --email=person@alamotechllc.com
```

3. The command looks up the existing Firebase user by email. It does not create a Google user.
4. It refuses the email unless it is staff-eligible: Google sign-in and the domain `alamotechllc.com` (`OPERATOR_HOSTED_DOMAIN` when that is set).
5. It writes `platformAdmins/{uid}` with `status: active`, sets the `raasRole` claim to `platform_admin`, revokes refresh tokens, and writes `user.role_changed` to `platformAudit`.
6. The person signs in again. `GET /v1/session` returns `platform_admin` only because the server record exists.

The phrase must match exactly. A missing user stops the command. The command prints the uid. It does not print a token.

This command is not part of deploy, CI, or seed. Production Firebase credentials stay off the developer machine unless this step is intentionally run.

## Emulator

The emulator bootstrap is separate. Use the Auth emulator host and a local email:

```bash
BOOTSTRAP_PHRASE='AUTHORIZE PLATFORM ADMIN BOOTSTRAP' \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9198 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8280 \
FIREBASE_PROJECT_ID=demo-raas-cp \
npm run bootstrap:platform-admin -- --email=admin@alamotechllc.test
```

Create that emulator user first (the Auth emulator UI or a local script). `@alamotechllc.test` is eligible only while `FIREBASE_AUTH_EMULATOR_HOST` is set. `npm run seed:operator` still creates the operator `operator@alamotechllc.test` and does not grant `platform_admin`.

## What this command will not do

- It will not grant admin to the first signed-in user.
- It will not grant admin to every Workspace user.
- It will not grant admin to `user@gmail.com`, even if a document is written by hand: the API rejects a staff record that fails the domain check.
- It will not open Firestore to the browser.

User administration in the product UI is the next phase. Until that exists, role changes go through this command or a reviewed server script that calls `grantPlatformAdmin` and `writeAuthorizationAudit`.
