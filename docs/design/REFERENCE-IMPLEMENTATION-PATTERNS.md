# Reference implementation patterns (Phase 2)

**Project:** `at-alamotechllc-webapp`  
**Date:** 2026-10-28  
**Status:** Recommendation only — do not auto-promote to factory `design-system/` without review.

| Pattern | Location | Why it worked | Promotion candidate |
|---------|----------|---------------|---------------------|
| **PageHeader / DashboardSection** | `components/alamo/page-header.tsx` | Consistent command-center context + STATUS/CHANGE/ACTION labels | Yes — factory component spec |
| **PillNav** | `components/alamo/pill-nav.tsx` | Period toggles with shared `layoutId` motion | Yes — when Framer Motion is adopted |
| **AppCard tiers** | `components/ui/card.tsx` (`primary` / `secondary` / `tertiary`) | Whitespace and radius encode hierarchy without color noise | Yes — document tier API in COMPONENT-STANDARD |
| **PageTransition + StaggerGrid** | `components/alamo/motion.tsx` | Restrained 180–300ms motion; respects reduced motion | Yes — motion primitives |
| **SkeletonCard** | `components/alamo/skeleton.tsx` | Layout-aware loading vs spinners | Yes |
| **EmptyState (icon + actions)** | `components/ui/states.tsx` | Professional empty UX | Yes |
| **Home STATUS/CHANGE/ACTION layout** | `command-center.tsx` (`detail="home"`) + `pages.tsx` aside | Answers executive questions in order; action column on mobile first | Yes — extend DASHBOARD-STANDARD with layout sketch |
| **Sidebar pill nav** | `sidebar-nav.tsx` | “Operating a system” wayfinding | Yes — AppShell / PillNav spec |
| **Token-only chart strokes** | `command-center.tsx` `ActivityChart` | Removed literal hex; semantic accent/secondary | Yes — document in DESIGN-STANDARD |

## Not promoted yet

- Framer Motion as mandatory — still one optional dependency per app.
- Full render-tier Hallmark captures — requires puppeteer-core on operator host.
