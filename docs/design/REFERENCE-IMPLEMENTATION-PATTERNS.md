# Reference implementation patterns (Phase 2)

**Project:** `at-alamotechllc-webapp`  
**Date:** 2026-10-28  
**Status:** Recommendation only — do not auto-promote to factory `design-system/` without review.

| Pattern | Location | Phase 3 classification | Notes |
|---------|----------|------------------------|-------|
| **PageHeader / DashboardSection** | `components/alamo/page-header.tsx` | **NEEDS ANOTHER IMPLEMENTATION** | Visually approved here; validate on a second app before factory API |
| **PillNav** | `components/alamo/pill-nav.tsx` | **NEEDS ANOTHER IMPLEMENTATION** | Depends on Framer Motion |
| **AppCard tiers** | `components/ui/card.tsx` | **PROVEN** (reference only) | Document tier names in factory; extract package later |
| **PageTransition + StaggerGrid** | `components/alamo/motion.tsx` | **NEEDS ANOTHER IMPLEMENTATION** | |
| **SkeletonCard** | `components/alamo/skeleton.tsx` | **PROVEN** (reference only) | |
| **EmptyState (icon + actions)** | `components/ui/states.tsx` | **PROVEN** (reference only) | |
| **Home STATUS/CHANGE/ACTION layout** | `command-center.tsx` + `pages.tsx` | **PROJECT-SPECIFIC** | Lead Capture IA; reuse principles not exact layout |
| **Sidebar pill nav** | `sidebar-nav.tsx` | **NEEDS ANOTHER IMPLEMENTATION** | |
| **Token-only chart strokes** | `ActivityChart` | **PROVEN** (reference only) | Reusable rule, not a component |
| **Playwright reference capture** | `scripts/capture-reference-screens.sh` | **PROVEN** (workflow) | Standard for authenticated SPA visual archive |

## Not promoted yet

- Framer Motion as mandatory — still one optional dependency per app.
- Full render-tier Hallmark captures — requires puppeteer-core on operator host.
