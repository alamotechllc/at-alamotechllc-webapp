# AlamoOS reference implementation — visual lock

**Application:** Lead Capture RaaS MVP (`at-alamotechllc-webapp`)  
**Branch:** `dev`  
**Visually approved:** 2026-10-28 (Phase 3)  
**Code baseline:** commit `fc65488` (Phase 2) + Phase 3 QA commits

This is the first **visually validated** AlamoOS application. Screenshots are **reference language**, not pixel tests for other products.

## Render environment

| Item | Value |
|------|--------|
| Hallmark | Host `~/.agents/skills/hallmark` v2.0.0 |
| Render tier | **Host** `puppeteer-core@23.11.1` (`npm install -g`) |
| Browser | Google Chrome (macOS default path) |
| AlamoOS CLI | `./scripts/alamo-ui-review` (sets `HALLMARK_PUPPETEER`, stderr separated from JSON) |
| Authenticated captures | `scripts/capture-reference-screens.sh` (Firebase emulators + Playwright) |
| Setup doc | [`RENDER-QA-SETUP.md`](RENDER-QA-SETUP.md) |

Hallmark `--url` on `/sign-in` validates render tier without auth. Signed-in views use Playwright archives below.

## Canonical screenshots

| File | Viewport | Demonstrates |
|------|----------|--------------|
| [`evidence/reference-screens/command-center-desktop.png`](../../evidence/reference-screens/command-center-desktop.png) | 1440×900 | STATUS / CHANGE / ACTION home, shell, card tiers, chart |
| [`evidence/reference-screens/command-center-phone.png`](../../evidence/reference-screens/command-center-phone.png) | Pixel 7 | ACTION-first mobile order, header controls |
| [`evidence/reference-screens/next-steps-drawer-desktop.png`](../../evidence/reference-screens/next-steps-drawer-desktop.png) | 1440×900 | ACTION drawer, progress, primary/secondary buttons |
| [`evidence/reference-screens/tasks-workspace-desktop.png`](../../evidence/reference-screens/tasks-workspace-desktop.png) | 1440×900 | Workspace page header, form + list |
| [`evidence/reference-screens/appointments-desktop.png`](../../evidence/reference-screens/appointments-desktop.png) | 1440×900 | Data-heavy table surface |

## Design decisions locked in this reference

- **Home IA:** Labeled sections Status → Change; funnel as tertiary; Next Steps + tasks in action column (desktop left); phone stacks **Next Steps before Status**.
- **Shell:** Persistent sidebar + sticky header; pill active nav with motion; mobile **Account** label instead of truncated email.
- **Cards:** `primary` / `secondary` / `tertiary` on `AppCard`.
- **Motion:** Page transition ~220ms; sidebar `layoutId`; dashboard stagger; reduced-motion disables animation.
- **Charts:** Token strokes only; legend dots; no decorative grid.
- **Intentional exceptions:** Performance score may show “—” when seed data is insufficient; gate 70 WARN on tasks button (static analysis vs Firestore write).

## Hallmark evidence

| Phase | Artifact |
|-------|----------|
| 2 static baseline | `evidence/ui-review-baseline-2026-10-28.json` |
| 2 static final | `evidence/ui-review-final-2026-10-28.json` |
| 3 render | `evidence/ui-review-phase3-render-2026-10-28.json` (`render: ran` on `/sign-in`) |

## Human visual review summary (Phase 3)

**Desktop:** Hierarchy readable in ~5s — action column, score, KPIs, change chart. Calm premium SaaS tone; not admin-template dense.

**Phone:** Next Steps leads viewport; header fits with Account label; Status follows without horizontal overflow.

**Motion:** Nav pill and page enter feel subtle; drawer overlay readable.

## Promotion classification (Phase 3)

See updated table in [`REFERENCE-IMPLEMENTATION-PATTERNS.md`](REFERENCE-IMPLEMENTATION-PATTERNS.md).

## Regenerate captures

```bash
bash scripts/capture-reference-screens.sh
```
