# Lead Capture deployment runbook

## Critical rule

A DEV Hosting deploy is the normal path for this application once the gates in this runbook pass. Do not ask again for that Hosting preview.

Creating a Firebase project, enabling billing, registering DNS, deploying Firestore rules, or deploying Cloud Run is not a DEV Hosting deploy. Those stay stopped until their own conditions below are met.

PRODUCTION / MAIN may never be deployed without explicit human authorization for the exact commit being released.

Authentication of the developer or access to Firebase is not production authorization.

A bare request to "deploy" means the DEV Hosting procedure. Production must be named explicitly, and this runbook still stops for authorization.

## Instructions for Cursor / AI agents

When asked to "deploy", "deploy everything", "ship it", "push this live", or similar:

1. Decide the target. If the user did not say production, live, or main, the target is DEV Hosting.
2. Run `npm run deploy:dev`. Do not invent a bare `firebase deploy`.
3. For production, run `npm run deploy:prod` and stop at the authorization gate.
4. Never treat permission to edit the repository, a previous chat, a green local test, or Firebase login as permission to deploy production.
5. Never reuse a production authorization from a prior session or a different commit.
6. If the commit changes after approval, the approval is void. Ask again.
7. Do not force-push, rewrite history, or delete branches.
8. Do not create the Firebase project, a database, a Hosting site, or a Cloud Run service from this runbook. The script deploys only to the project id already named below, and only after the gates pass.

The only production confirmation phrase is:

```text
AUTHORIZE PRODUCTION DEPLOY
```

Anything less explicit is not authorization. "looks good", "continue", "ship it", and "deploy" are not authorization.

There is no `PRODUCTION_APPROVED` flag in source control. Do not add one.

## Environment matrix

| Environment | Git branch | Firebase target | Purpose |
| --- | --- | --- | --- |
| Local | feature branch or `dev` | Emulators, project `demo-raas-cp` | Development. Destructive tests stay here. |
| DEV | `dev` | Hosting preview channel `dev` on `at-alamotechllc-webapp` | Integration check of the operator UI |
| PROD | `main` | Hosting live channel on `at-alamotechllc-webapp` | Production operator UI |

| Item | Value |
| --- | --- |
| Firebase project | `at-alamotechllc-webapp` |
| Emulator project | `demo-raas-cp` (never a deploy target) |
| `.firebaserc` default | `demo-raas-cp`, so a bare Firebase command does not select the cloud project |
| Hosting public dir | `apps/web/dist` |
| Dev channel | `dev` |
| Dev retention | 30 days (`--expires 30d`). Redeploy to refresh. |
| Firestore rules | `firebase/firestore.rules`, deny-all |
| Storage rules | `firebase/storage.rules`, deny-all |
| Cloud Run | `raas-api`, `raas-ingress`, `ghl-adapter`. Not packaged in this repository. |

`.firebaserc` also records aliases `dev` and `prod` for `at-alamotechllc-webapp`. Deploy scripts pass `--project` themselves. Do not run `firebase use dev` as a substitute for the script.

## DEV Hosting is not a separate backend

A Hosting preview channel is another URL for the same Firebase project as production Hosting.

Until Cloud Run exists, that URL has no `raas-api`, `raas-ingress`, or `ghl-adapter`. The release build refuses to embed the Auth emulator or `demo-raas-cp`. It requires:

- `VITE_FIREBASE_PROJECT_ID=at-alamotechllc-webapp`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_API_BASE_URL` starting with `https://`

Those values are public web config plus the API origin. They are not service-account keys. Do not commit them. Do not prefix a server secret with `VITE_`.

`npm run deploy:dev` deploys Hosting only. It does not deploy Firestore rules, Storage rules, or Cloud Run. Rules are project-wide: deploying them changes every environment that shares the project, so they have their own production gate.

Local destructive tests stay on the emulators (`npm run test:emulators`, Auth `9198`, Firestore `8280`, Storage `9399`).

## What this repository cannot deploy yet

`npm run deploy:dev` stops before Firebase when any stop condition below is true. `origin` is `https://github.com/alamotechllc/at-alamotechllc-webapp.git`. The script reads only `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, and `VITE_API_BASE_URL` from the environment or from gitignored `.env`. It does not read the GoHighLevel token. `VITE_API_BASE_URL` is still unset because `raas-api` has no HTTPS origin. There is no hosted smoke suite. The script records a DEV stamp only after Firebase returns a preview URL, and it marks smoke `not-automated`. Production refuses that stamp.

Do not paper over those stops by calling `firebase deploy` directly.

## Branch model

```text
feature/work
    ↓
dev
    ↓
Firebase preview channel dev
    ↓
Validation
    ↓
Production authorization
    ↓
main  (fast-forward only)
    ↓
Firebase Hosting live
```

Canonical branches are `dev` and `main`. Do not add extra environment branches.

`main` is the production source. The live Hosting release must match a commit that was pushed to `origin/main`.

## Commands

The script is `scripts/deploy.ts`. Do not improvise a bare `firebase deploy`.

```bash
# DEV Hosting preview, after the gates inside the script.
npm run deploy:dev

# PROD preparation. Prints the plan and exits. Does not merge or deploy.
npm run deploy:prod

# PROD, only after the phrase and only for the SHA that passed DEV smoke.
npm run deploy:prod -- --authorize "AUTHORIZE PRODUCTION DEPLOY" --sha <full-sha>

# Rules alone. Production database change. Same phrase. Branch must be main.
npm run deploy:rules -- --authorize "AUTHORIZE PRODUCTION DEPLOY" --sha <full-sha>
```

`deploy:rules` currently stops before Firebase. Rules stay deny-all and are not deployed from a Hosting command.

## Quality gate

`npm run deploy:dev` runs this after the git and web-config checks. Any failure stops the script.

1. `npm run typecheck`
2. `npm run lint`
3. `npm run guard:frontend`
4. `npm run test:unit`
5. `npm run test:emulators` on `demo-raas-cp`
6. `npm run build -w @raas/web` with emulators off, the release channel, the git SHA, and the build time
7. `npm run scan:secrets`

`npm run validate` is typecheck, lint, the frontend guard, and unit tests. `npm run validate:release` adds the emulator suite and the secret scan. Neither command deploys.

There is no Playwright suite in this repository. Do not point the emulator tests at a preview or live URL. A DEV stamp whose smoke is not `pass` cannot be promoted.

## Release identity

DEV and production builds set `VITE_DEPLOY_CHANNEL`, `VITE_GIT_SHA`, and `VITE_BUILT_AT`. The operator account menu shows the channel and the short SHA. `index.html` carries `raas-channel`, `raas-git-sha`, and `raas-built-at`. Local `npm run dev:web` reports channel `local` and SHA `unknown`.

The local dev server still connects to the Auth emulator. A production build does not, unless `VITE_USE_FIREBASE_EMULATORS=true`, which the deploy script rejects.

## DEV procedure

Run from a clean `dev` branch that tracks `origin/dev`.

```bash
git checkout dev
git fetch origin
git status
npm run deploy:dev
```

The script then:

1. Refuses any Firebase project other than `at-alamotechllc-webapp`, including `demo-raas-cp`.
2. Refuses a Hosting public directory other than `apps/web/dist`.
3. Refuses a missing commit, a branch other than `dev`, a dirty worktree, a missing `origin`, or a `dev` branch that has diverged or is behind.
4. Refuses a release web config that still points at the emulator.
5. Runs the quality gate.
6. Pushes `HEAD` to `origin/dev` without force.
7. Deploys Hosting preview channel `dev` for 30 days.
8. Stops if Firebase does not return an `https` URL.
9. Writes `.deploy/last-dev.json` (gitignored) with smoke `not-automated` and exits non-zero. That stamp does not authorize production.

Report the commit, the preview URL, the time, and the smoke result. Smoke `not-automated` means the preview, if Firebase created one, is not a promotion candidate.

## PRODUCTION procedure

Do this only after a DEV deploy of the same commit has smoke `pass`.

```bash
git checkout dev
git status
npm run deploy:prod
```

That command prints the branch, SHA, project, and Hosting resource, then exits. It does not merge, push `main`, or deploy.

Authorize that exact commit with:

```bash
npm run deploy:prod -- --authorize "AUTHORIZE PRODUCTION DEPLOY" --sha <full-40-char-sha>
```

The script then checks the phrase, the SHA, a `dev` branch, and a DEV stamp whose smoke is `pass`. It fast-forwards `main` to that SHA, pushes `origin/main` without force, rebuilds with channel `production`, and deploys Hosting only.

If `main` cannot fast-forward, it stops and Firebase is not changed. A new commit voids the approval.

## Cloud Run

`raas-api`, `raas-ingress`, and `ghl-adapter` are local Node processes. This repository has no container image. Hosting authorization does not deploy them.

Each service needs its own phrase and the full SHA:

```text
AUTHORIZE RAAS API DEV DEPLOY
AUTHORIZE RAAS INGRESS DEV DEPLOY
AUTHORIZE GHL ADAPTER DEV DEPLOY
```

```bash
npx tsx scripts/deploy.ts cloud-run raas-api --authorize "AUTHORIZE RAAS API DEV DEPLOY" --sha <full-sha>
```

The command stops. It does not call `gcloud`, create a service, or grant `allUsers`.

Invoker for a future service is not `allUsers`. Ingress keeps failing closed unless `OIDC_MODE=local` and the Firestore emulator are both set. Do not deploy the local ingress token.

## Secret handling

Never commit:

- `.env`, `.env.local`, `.env.production`, or any private env file
- service-account JSON, `FIREBASE_PRIVATE_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`
- `GHL_PRIVATE_INTEGRATION_TOKEN` or a GoHighLevel client secret
- GitHub tokens or raw private keys

`npm run scan:secrets` scans tracked and untracked source that git does not ignore. A finding stops the deploy. The report names the file and the rule, not the secret value.

The Firebase web API key may appear in the browser bundle. A private key, a service-account file, or a GoHighLevel private token may not.

GitHub Actions runs tests only. Do not add a workflow that deploys Hosting, rules, or Cloud Run.

## Stop conditions

Stop and do not deploy when any of these are true:

- dirty worktree
- no commit, or the branch is not `dev` for a DEV deploy
- production Firebase deploy is attempted from any branch other than the fast-forwarded `main`
- unit, emulator, lint, typecheck, or the frontend guard fails
- the web config is missing or still uses the emulator
- the secret scan reports a finding
- local and `origin/dev` have diverged, or local is behind origin
- fast-forward of `main` fails
- the Firebase project is not `at-alamotechllc-webapp`
- the Hosting public directory is not `apps/web/dist`
- production deploy has no current authorization phrase
- the approved SHA is not the commit about to be released
- the DEV stamp is missing, is for another SHA, or smoke is not `pass`
- Firebase does not return a preview URL
- the request is to create the cloud project, DNS, or a Cloud Run service

## Rollback

Do not invent a `hosting:rollback` command.

Production rollback is a new production action and needs `AUTHORIZE PRODUCTION DEPLOY` for the rollback commit or console release.

1. Identify the live release in Firebase Console → Hosting for `at-alamotechllc-webapp`, and `git log origin/main -5`.
2. Choose a previous Hosting release or an older commit already on `main`.
3. Get explicit authorization for that rollback.
4. Roll back in the console, or check out that `main` commit and run the authorized production command.
5. Report the URL and the resulting SHA.

`hosting:clone` of a preview onto live is a production deploy and needs the same authorization.

## GoHighLevel

The Marketplace app workspace under `ghl-lead-capture` is not deployed by this runbook. Subscribing `AppointmentCreate` still needs a public HTTPS webhook URL. The local adapter on port `8093` is not that URL.
