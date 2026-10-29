# Render-tier visual QA setup

Hallmark **render** analysis requires operator-host tooling, not app dependencies.

## One-time host setup

```bash
npm install -g puppeteer-core
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"  # if auto-detect fails
```

AlamoOS `./scripts/alamo-ui-review` sets `HALLMARK_PUPPETEER` from `npm root -g` when `puppeteer-core` is present.

## Authenticated reference screenshots

This app requires Firebase Auth. Use:

```bash
bash scripts/capture-reference-screens.sh
```

Output: `evidence/reference-screens/`

Requires Java (Firebase emulators) and Playwright (devDependency).

## Hallmark CLI (static + optional render)

From AlamoOS factory root:

```bash
./scripts/alamo-ui-review --project at-customer-webapp --render --url http://127.0.0.1:5173/sign-in
```

Use a running `npm run dev:web` (with emulators env for full app). Public `/sign-in` validates render tier without a session.

## Phase evidence files

| Phase | Files |
|-------|--------|
| 2 static | `evidence/ui-review-baseline-2026-10-28.json`, `ui-review-final-2026-10-28.json` |
| 3 render | `evidence/ui-review-phase3-render-2026-10-28.json` |
