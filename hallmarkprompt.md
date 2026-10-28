# hallmarkprompt.md

**Project:** Lead Capture RaaS MVP (`at-alamotechllc-webapp` / manifest `at-customer-webapp`)  
**Primary UI:** `apps/web/` (tenant command center, action center, shell navigation)

UI/UX design audit and improvement uses the factory prompt [`../../designprompt.md`](../../designprompt.md).

Read that file and follow it. Use this project in the fill-in. Default ambiguous UI language to **AUDIT**. This pointer is not a second copy of the workflow.

**Hallmark skill:** Host-installed [Hallmark](https://github.com/Nutlope/hallmark) — read `~/.agents/skills/hallmark/SKILL.md`; do not vendor Hallmark into this repo.

**Brand hints:** `apps/web/public/brand/`, `apps/web/src/index.css`, shared UI under `apps/web/src/components/`.

**Active Hallmark theme:** **Coral** — read `~/.agents/skills/hallmark/references/themes/coral.md`. Tokens and controls live in `apps/web/src/index.css` (stamp `theme: coral`). **Alamo navy and accent blue stay locked** for primary/signal colors; see `design.md`.

Do not write Kernel findings or implement redesigns until `docs/service-relationship.md` is approved or `NOT_APPLICABLE`, except read-only **AUDIT** mode.
