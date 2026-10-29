# Phase 3 visual QA report

**Date:** 2026-10-28  
**Visual lock:** [`REFERENCE-IMPLEMENTATION-VISUAL.md`](REFERENCE-IMPLEMENTATION-VISUAL.md)

## Render environment

| Item | Result |
|------|--------|
| Missing dependency | Host `puppeteer-core` (was not installed globally) |
| Resolution | `npm install -g puppeteer-core@23.11.1` — **not** added to app package.json |
| Browser | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| AlamoOS CLI fix | `HALLMARK_PUPPETEER` fallback to `~/.npm-global/lib/node_modules`; sloplint stderr separated from JSON |
| Authenticated PNGs | Playwright + `firebase emulators:exec` via `scripts/capture-reference-screens.sh` |

## Visual review

### Desktop (1440×900)

- STATUS/CHANGE/ACTION readable within first viewport + action column.
- Card tiers distinguish score block vs KPI stack vs funnel.
- Chart minimal; appropriate for sparse seed data.
- Shell reads as software (sidebar pill, sticky header).

### Phone (Pixel 7)

- Next Steps appears before Status (verified visually).
- Header: **Account** label after fix (avoids `tenant.a…` truncation).
- No horizontal overflow observed on home capture.

### Motion (manual / prior session)

- Page transition, sidebar pill, drawer overlay — subtle; reduced-motion path unchanged in code.

## Changes (Phase 3)

- Mobile account summary label in `shell.tsx`
- Visual capture tooling: `playwright.visual.config.ts`, `tests/visual/reference-capture.spec.ts`, `scripts/capture-reference-screens.sh`
- E2e expectation: Home **Status** heading (Phase 2 IA)
- Docs: `RENDER-QA-SETUP.md`, `REFERENCE-IMPLEMENTATION-VISUAL.md`, pattern classifications
- Evidence: `evidence/reference-screens/*`, `evidence/ui-review-phase3-render-2026-10-28.json`

## Hallmark

| | Static (Phase 2 final) | Render (Phase 3) |
|--|------------------------|------------------|
| Advisory | 99 | 99 |
| FAIL | 0 | 0 |
| REFLEX | 0 | 0 |
| WARN | 1 (gate 70) | 1 (gate 70) |
| Render | not run | **ran** (`/sign-in`, shots under factory `.hallmark/shots`) |

Documented exception: gate 70 — Firestore `setTaskStatus` exists; static analyzer cannot see it.

## Next step (one)

Use **`at-rv-webapp`** or **`at-cto-msp-webapp`** as the **second** design-system implementation (dashboard/shell overlap, active AlamoOS projects) — do not migrate until Phase 3 visual lock is reviewed by operator.
