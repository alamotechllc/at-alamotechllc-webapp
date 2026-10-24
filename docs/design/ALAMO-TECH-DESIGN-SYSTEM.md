# Alamo Tech design system

Source of truth: the public website implementation.

| | |
| --- | --- |
| Local checkout | `App_Projects/at-alamotechllc-website` |
| Git remote | `alamotechllc/alamo-tech-growth-engine` |
| Production | [alamotechllc.com](https://alamotechllc.com) |
| Inspected | 2026-10-23 |
| Files | `tailwind.config.ts`, `src/index.css`, `components.json`, `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `alert.tsx`, `src/components/layout/Navbar.tsx`, `Header.tsx`, `AlamoLogo.tsx`, `src/components/home/Hero.tsx` |

There is no `App_Projects/at-growth-engine` directory on this machine. The growth-engine repository is checked out as `at-alamotechllc-website`. This document records that checkout. The website project was not modified.

The private application (`at-alamotechllc-webapp`) should use these tokens. Do not introduce a second palette.

## How the site styles UI

The site is shadcn/ui on Tailwind CSS 3.4 (`darkMode: ["class"]`, `cssVariables: true`, base color slate).

| Mechanism | What it does |
| --- | --- |
| CSS custom properties | HSL components, without the `hsl()` wrapper, so utilities can write `hsl(var(--primary))` |
| Tailwind theme `extend.colors` | Maps `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `card`, `popover`, `sidebar` to those variables |
| Static `brand` colors | Hex reference only. The config comment says to prefer semantic tokens for UI |
| `class-variance-authority` | Button and badge variants |
| Utility classes | Layout, type scale, spacing, and most shadows |
| `cn()` | `clsx` + `tailwind-merge` in `src/lib/utils.ts` |

Declared in `src/index.css` and not referenced by components: `--gradient-hero`, `--gradient-section`, `--gradient-card`, `--shadow-card`, `--shadow-hero`, `--shadow-button`, `--font-hero`, `--font-h1` through `--font-small`, `--spacing-hero`, `--spacing-section`, `--spacing-card`. Live components use Tailwind utilities instead (`shadow-sm`, `text-4xl`, `p-6`, `py-20`).

## Color tokens

Light values are `:root`. Dark values are `.dark`. The site default theme is `system` (`src/App.tsx`).

### Semantic HSL

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `210 40% 98%` | `222 47% 6%` |
| `--foreground` | `215 28% 17%` | `210 40% 98%` |
| `--card` | `0 0% 100%` | `222 47% 10%` |
| `--card-foreground` | `215 28% 17%` | `210 40% 98%` |
| `--popover` | `0 0% 100%` | `222 47% 10%` |
| `--popover-foreground` | `215 28% 17%` | `210 40% 98%` |
| `--primary` | `210 65% 15%` | `210 65% 25%` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--primary-hover` | `210 65% 22%` | `210 65% 32%` |
| `--secondary` | `210 10% 50%` | `210 10% 60%` |
| `--secondary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--muted` | `214 32% 91%` | `217 33% 17%` |
| `--muted-foreground` | `215 16% 40%` | `215 20% 65%` |
| `--accent` | `205 60% 45%` | `205 70% 55%` |
| `--accent-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--accent-hover` | `205 55% 38%` | `205 65% 48%` |
| `--destructive` | `0 84% 60%` | `0 62.8% 30.6%` |
| `--destructive-foreground` | `0 0% 100%` | `210 40% 98%` |
| `--border` | `214 32% 91%` | `217 33% 17%` |
| `--input` | `214 32% 91%` | `217 33% 17%` |
| `--ring` | `205 60% 45%` | `205 70% 55%` |
| `--radius` | `0.75rem` | `0.75rem` |

Sidebar tokens match the page in light mode (`--sidebar-background: 210 40% 98%`, foreground `215 28% 25%`, primary `210 65% 15%`, accent `214 32% 91%`, border `214 32% 91%`, ring `205 60% 45%`). Dark sidebar background is `222 47% 8%` and its primary is the accent `205 70% 55%`. The public header does not use the shadcn sidebar component. These variables still exist and are the sidebar contract.

### Static brand hex

From `tailwind.config.ts` `theme.extend.colors.brand`. These are a reference palette. Components on the site do not use `bg-brand-*`.

| Name | Hex |
| --- | --- |
| `navy` | `#0B1F33` |
| `navySoft` | `#123A5A` |
| `steel` | `#6E7B87` |
| `steelDark` | `#3E4A54` |
| `accentBlue` | `#2F6B9A` |
| `accentGlow` | `#4FA3D9` |
| `backgroundLight` | `#F8FAFC` |
| `backgroundDark` | `#020617` |

`theme-color` in `index.html` is `#0B1F33`.

### Status colors

The marketing CSS does not define `--success` or `--warning`.

Healthy and active states on the public site are expressed with `text-primary` (current nav item) and `bg-accent` (call-to-action). The destructive alert variant is a border and text color (`border-destructive/50 text-destructive`), not a filled red surface. One consult page uses Tailwind `green-100` / `green-600` for an icon tile. That green is not a token.

The favicon SVG uses `#2563eb` and `#10b981`. Those hex values are not the CSS tokens and must not become the application palette.

Application mapping, using only values from this system:

| Application token | Source |
| --- | --- |
| `--surface` | `--card` |
| `--surface-muted` | `--muted` |
| `--foreground-muted` | `--muted-foreground` |
| `--error` | `--destructive` |
| `--success` | `--accent` |
| `--warning` | brand `steelDark` `#3E4A54`, stored as HSL `207 15% 29%` |

`--success` and `--warning` are aliases for operational status. They are not a second brand.

## Typography

No web font is loaded. No `fontFamily` extension exists. Tailwind preflight supplies the sans stack:

`ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`

| Use | Classes in the site | Weight |
| --- | --- | --- |
| Hero headline | `text-4xl md:text-5xl lg:text-6xl font-bold leading-tight` | 700 |
| Hero subhead | `text-xl md:text-2xl text-muted-foreground leading-relaxed` | 400 |
| Card title | `text-2xl font-semibold leading-none tracking-tight` | 600 |
| Section heading in articles | `text-3xl font-bold`, `text-2xl font-semibold`, `text-xl font-semibold` | 700 / 600 |
| Navigation | `text-sm font-medium` | 500 |
| Body | browser default `1rem` | 400 |
| Small / descriptions | `text-sm text-muted-foreground` | 400 |
| Badges | `text-xs font-semibold` | 600 |
| Buttons | `text-sm font-medium` | 500 |

Declared but unused: `--font-hero: 3.5rem`, `--font-h1: 2.5rem`, `--font-h2: 2rem`, `--font-h3: 1.5rem`, `--font-body: 1rem`, `--font-small: 0.875rem`.

Hero emphasis uses `bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent`. That treatment is for the marketing headline, not for operational numbers.

## Spacing, radius, shadow, motion

Tailwind defaults apply (`0.25rem` steps). Container: centered, `padding: 2rem`, `2xl: 1400px`.

Breakpoints are Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. The container caps `2xl` at 1400px. Mobile navigation starts below `md`.

| Token | Value | Where it shows up |
| --- | --- | --- |
| `--radius` | `0.75rem` | `rounded-lg` |
| `rounded-md` | `calc(var(--radius) - 2px)` | buttons, inputs |
| `rounded-sm` | `calc(var(--radius) - 4px)` | smaller controls |
| `rounded-full` | pill | badges |
| `rounded-xl` | used on hero tiles | same 0.75rem as default `xl`, so it matches `--radius` |
| Card padding | `p-6`, header `space-y-1.5` | shadcn card |
| Header height | `h-16` | navbar |
| Nav gap | `space-x-8` desktop, `space-y-4` mobile | navbar |
| Page padding | `px-4`, container `2rem` | header and sections |

Live card elevation is `shadow-sm`, with `hover:shadow-md transition-shadow` on marketing tiles. Buttons use `shadow-sm`. The CTA variant adds `shadow-md hover:shadow-lg` and `hover:-translate-y-0.5`.

Declared shadows, unused by class name:

```css
--shadow-card: 0 4px 6px -1px hsl(var(--primary) / 0.1), 0 2px 4px -1px hsl(var(--primary) / 0.06);
--shadow-hero: 0 20px 25px -5px hsl(var(--primary) / 0.1), 0 10px 10px -5px hsl(var(--primary) / 0.04);
--shadow-button: 0 10px 15px -3px hsl(var(--accent) / 0.2), 0 4px 6px -2px hsl(var(--accent) / 0.1);
```

Motion: buttons `transition-all duration-200`, links `transition-colors`, accordion keyframes `0.2s ease-out` via `tailwindcss-animate`. No `prefers-reduced-motion` rule exists on the site.

## Components

### Buttons

Base: `inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-200`.

Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

Disabled: `pointer-events-none opacity-50`.

| Variant | Classes |
| --- | --- |
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm` |
| `accent` | `bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm` |
| `cta` | accent background plus `shadow-md hover:shadow-lg hover:-translate-y-0.5` |
| `outline` | `border border-border bg-background hover:bg-muted hover:text-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

Sizes: default `h-10 px-4`, `sm` `h-9 px-3`, `lg` `h-11 px-8`, icon `h-10 w-10`.

### Links and navigation

Header: `sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md`.

Desktop links: `text-sm font-medium`. Current page is `text-primary`. Other links are `text-muted-foreground` and `hover:text-primary`.

Mobile: a `md:hidden` menu button (`Menu` / `X` from `lucide-react`, 24px) with `focus-visible:ring-2 focus-visible:ring-ring`. The panel is `border-t border-border`, links `px-4 py-2`.

The logo is absolutely positioned at the left of the header (`h-[4.225rem]` below `md`, `h-[6.76rem]` at `md`). Assets:

- `/assets/alamo-tech-logo-light.png` (light theme)
- `/assets/alamo-tech-logo-dark.png` (dark theme and footer)

Both are 805×1024 transparent PNGs of the circular mark plus the “ALAMO TECH” wordmark. `AlamoLogo` swaps them with `dark:hidden` / `hidden dark:block`.

### Cards, badges, inputs, alerts

Card: `rounded-lg border border-border bg-card text-card-foreground shadow-sm`.

Badge: `inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Variants are `default` (primary), `secondary`, `destructive`, and `outline`.

Input: `h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm`. Placeholder `text-muted-foreground`. Same focus ring as buttons. Disabled `opacity-50`.

Alert destructive: border and foreground in the destructive hue, background stays the surface.

### Icons

`lucide-react` `^0.462.0`. The header uses `Menu`, `X`, and `Phone`.

## Application rules

Use semantic utilities: `bg-background`, `bg-surface`, `bg-surface-muted`, `text-foreground`, `text-foreground-muted`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-accent`, `text-accent-foreground`, `ring-ring`.

Do not put raw hex values in React components.

The private application keeps a sidebar because that is the operational shell. Color, type, radius, border, shadow, and focus follow this document. Page titles use the site’s section scale (`text-2xl` / `md:text-3xl font-bold`), not the marketing hero scale. A period-over-period metric is not shown unless the API returns one.

Active navigation uses the accent fill (`bg-accent text-accent-foreground`), which is the site’s accent button treatment. Inactive items use `text-foreground-muted` and `hover:text-primary`, matching the header links.

Application primary actions use the `default` button (navy). Accent stays on the active nav item and on status that means healthy, so a screen does not fill with competing call-to-action buttons.

Errors use the site’s destructive alert pattern: a surface with an error border, not a red panel behind every card. `0` is a measured value. `Unavailable` means the request failed.
