# hallmarkprompt.md

**Project:** Lead Capture RaaS MVP (`at-alamotechllc-webapp` / manifest `at-customer-webapp`)  
**Role:** **AlamoOS reference implementation** (design system + Hallmark QA)  
**Primary UI:** `apps/web/` (tenant command center, action center, shell navigation)

## Operator entry

UI/UX audit, build, and redesign follow the factory prompt [`../../designprompt.md`](../../designprompt.md) and [`../../design-system/README.md`](../../design-system/README.md).

Read those plus this project's lock files below. Use this project in the fill-in. Default ambiguous language to **AUDIT**.

**Hallmark skill:** Host-installed [Hallmark](https://github.com/Nutlope/hallmark) — read `~/.agents/skills/hallmark/SKILL.md`; do not vendor Hallmark into this repo.

Do not write Kernel findings or implement redesigns until `docs/service-relationship.md` is approved, except read-only **AUDIT** mode.

## Project design lock

| Doc | Purpose |
|-----|---------|
| [`design.md`](design.md) | Locked tokens, Coral theme, Command Center IA |
| [`docs/design/ALAMO-TECH-DESIGN-SYSTEM.md`](docs/design/ALAMO-TECH-DESIGN-SYSTEM.md) | Brand / shadcn token values |
| [`docs/design/REFERENCE-IMPLEMENTATION-VISUAL.md`](docs/design/REFERENCE-IMPLEMENTATION-VISUAL.md) | **Visual lock** (Phase 3) — canonical screenshots |
| [`docs/design/REFERENCE-IMPLEMENTATION-PATTERNS.md`](docs/design/REFERENCE-IMPLEMENTATION-PATTERNS.md) | Reusable patterns + promotion status |
| [`docs/design/RENDER-QA-SETUP.md`](docs/design/RENDER-QA-SETUP.md) | Host puppeteer-core + capture commands |
| [`.alamo/ui.json`](.alamo/ui.json) | Dev URL, routes, Hallmark lint targets |

**Brand implementation:** `apps/web/public/brand/`, `apps/web/src/index.css`, `apps/web/src/components/`.

**Active Hallmark theme:** **Coral** — `~/.agents/skills/hallmark/references/themes/coral.md`. Stamp in `index.css`: `theme: coral`. **Alamo navy and accent blue stay locked** for primary/signal colors.

## Hallmark / AlamoOS QA workflow

**Static lint (factory root):**

```bash
cd /path/to/AlamoOS
./scripts/alamo-ui-review --project at-customer-webapp
```

**Render tier** (host `puppeteer-core` + Chrome — see [`RENDER-QA-SETUP.md`](docs/design/RENDER-QA-SETUP.md)):

```bash
npm run dev:web   # note actual port from Vite output
./scripts/alamo-ui-review --project at-customer-webapp --render --url http://127.0.0.1:5173/sign-in
```

A high static advisory score is **not** proof of visual completion; render + reference captures are required for material UI work.

**Authenticated reference screenshots** (Playwright + emulators — canonical visual archive):

```bash
npm run capture:reference-screens
```

Output: `evidence/reference-screens/` · Hallmark evidence: `evidence/ui-review-*.json` (baseline, final, phase3-render).

**Significant UI change:** IMPLEMENT → RUN → visual review → Hallmark (static + render when available) → fix material findings → re-capture if screenshots are evidence.

Skip Hallmark for trivial text-only edits.
