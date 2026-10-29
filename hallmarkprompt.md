# hallmarkprompt.md

**Project:** Lead Capture RaaS MVP (`at-alamotechllc-webapp` / manifest `at-customer-webapp`)  
**Role:** **AlamoOS reference implementation** (design system + Hallmark QA)  
**Primary UI:** `apps/web/` (tenant command center, action center, shell navigation)

## Operator entry

UI/UX audit, build, and redesign follow the factory prompt [`../../designprompt.md`](../../designprompt.md) and [`../../design-system/README.md`](../../design-system/README.md).

Read those plus this project's lock files below. Use this project in the fill-in. Default ambiguous language to **AUDIT**.

**Hallmark skill:** Host-installed [Hallmark](https://github.com/Nutlope/hallmark) — read `~/.agents/skills/hallmark/SKILL.md`; do not vendor Hallmark into this repo.

Do not write Kernel findings or implement redesigns until `docs/service-relationship.md` is approved, except read-only **AUDIT** mode.

### Factory parity (AlamoOS canonical)

| Doc | Purpose |
|-----|---------|
| [`../../design-system/ALAMOOS-BASE-THEME.md`](../../design-system/ALAMOOS-BASE-THEME.md) | Default operational theme (this project) |
| [`../../design-system/HALLMARK-WORKFLOW.md`](../../design-system/HALLMARK-WORKFLOW.md) | sloplint, capture, lifecycle, SPA/auth notes |
| [`../../host-tools/agent-skills/registry.json`](../../host-tools/agent-skills/registry.json) | Host skill id, modes, SkillSpector status |
| [`../../docs/AGENT-TOOLCHAIN.md`](../../docs/AGENT-TOOLCHAIN.md) | Hallmark vs other agent tools |

**Pre-flight reads (in order):** this project's [`design.md`](design.md), `.hallmark/brand-spec.md` if present, tokens/CSS, `package.json`, then [`.alamo/ui.json`](.alamo/ui.json).

**Modes** (fill-in in `designprompt.md`):

| Mode | Hallmark | May change UI? |
|------|----------|----------------|
| **AUDIT** | `hallmark audit <target>` | No — report only |
| **REDESIGN** | `hallmark redesign <target>` — only when authorized | Yes — scoped |
| **BUILD** | Read installed `SKILL.md` for new UI | Yes |
| **VALIDATE_ONLY** | sloplint / `alamo-ui-review` on existing output | Only to fix FAIL from prior authorized work |

Before **BUILD** or **REDESIGN**, if registry shows Hallmark SkillSpector **BLOCKED**, get explicit human acceptance per [`../../docs/security/SKILLSPECTOR.md`](../../docs/security/SKILLSPECTOR.md).

## Project design lock

| Doc | Purpose |
|-----|---------|
| [`design.md`](design.md) | Locked tokens, AlamoOS base theme, Command Center IA |
| [`docs/design/ALAMO-TECH-DESIGN-SYSTEM.md`](docs/design/ALAMO-TECH-DESIGN-SYSTEM.md) | Brand / shadcn token values |
| [`docs/design/REFERENCE-IMPLEMENTATION-VISUAL.md`](docs/design/REFERENCE-IMPLEMENTATION-VISUAL.md) | **Visual lock** (Phase 3) — canonical screenshots |
| [`docs/design/REFERENCE-IMPLEMENTATION-PATTERNS.md`](docs/design/REFERENCE-IMPLEMENTATION-PATTERNS.md) | Reusable patterns + promotion status |
| [`docs/design/RENDER-QA-SETUP.md`](docs/design/RENDER-QA-SETUP.md) | Host puppeteer-core + capture commands |
| [`.alamo/ui.json`](.alamo/ui.json) | Dev URL, routes, Hallmark lint targets |

**Brand implementation:** `apps/web/public/brand/`, `apps/web/src/index.css`, `apps/web/src/components/`.

**Active theme:** **AlamoOS base** — factory [`../../design-system/ALAMOOS-BASE-THEME.md`](../../design-system/ALAMOOS-BASE-THEME.md) + [`docs/design/ALAMO-TECH-DESIGN-SYSTEM.md`](docs/design/ALAMO-TECH-DESIGN-SYSTEM.md). **Not** a Hallmark theme deal; `design.md` overrides Hallmark theme files. Stamp in `index.css`: `theme: alamoos-base (locked design.md)`. **Alamo navy and accent blue stay locked** for primary/signal colors. Use Hallmark for **audit/lint only** unless a task explicitly names another theme and updates `design.md`.

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

**Multi-route capture** (uses `hallmark.routes` from [`.alamo/ui.json`](.alamo/ui.json); needs dev server + render tier):

```bash
./scripts/alamo-ui-review --project at-customer-webapp --render --url http://127.0.0.1:5173/sign-in --capture
```

Genre `modern-minimal` and scope `app` come from `.alamo/ui.json` when flags are omitted. Direct sloplint/capture: see [`HALLMARK-WORKFLOW.md`](../../design-system/HALLMARK-WORKFLOW.md).

A high static advisory score is **not** proof of visual completion; render + reference captures are required for material UI work.

**Authenticated reference screenshots** (Playwright + emulators — canonical visual archive):

```bash
npm run capture:reference-screens
```

Output: `evidence/reference-screens/` · Hallmark evidence: `evidence/ui-review-*.json` (baseline, final, phase3-render).

**Significant UI change:** IMPLEMENT → RUN → visual review → Hallmark (static + render when available) → fix material findings → re-capture if screenshots are evidence.

Skip Hallmark for trivial text-only edits.
