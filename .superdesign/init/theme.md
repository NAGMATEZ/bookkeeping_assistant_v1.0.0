# Theme

## Part 1 — Token summary

Tailwind CSS v4, CSS variables in `src/app/globals.css` (no `tailwind.config`). Semantic tokens are
mapped through `@theme inline` so utilities such as `bg-card`, `text-muted-foreground`,
`border-border`, `bg-primary`, `text-positive` work in both themes.

### Light (`:root`)

| Token | Value |
| --- | --- |
| background | `#f6f8fc` |
| foreground | `#0f172a` |
| card / popover | `#ffffff` / `#ffffff` |
| primary / primary-foreground | `#2563eb` / `#ffffff` |
| secondary / muted | `#eef2f9` / `#eef2f9` |
| muted-foreground | `#64748b` |
| accent / accent-foreground | `#e8f0fe` / `#1d4ed8` |
| destructive | `#dc2626` |
| positive / positive-foreground | `#059669` / `#ecfdf5` |
| border / input / ring | `#dce4f0` / `#b9c6da` / `#2563eb` |
| chart-line / chart-grid | `#2563eb` / `#dce4f0` |
| chart-1…5 | `#2563eb`, `#0ea5e9`, `#10b981`, `#6366f1`, `#14b8a6` |
| sidebar / sidebar-foreground | `#ffffff` / `#0f172a` |
| sidebar-primary / accent | `#2563eb` / `#e8f0fe` |
| sidebar-border | `#dce4f0` |
| page-glow | `radial-gradient(1100px 520px at 12% -8%, #dbeafe 0%, transparent 62%)` |
| radius | `0.625rem` |

### Dark (`.dark`)

| Token | Value |
| --- | --- |
| background | `#070b14` (near-black navy) |
| foreground | `#e6edf7` |
| card / popover | `#0d1424` / `#0f1728` |
| primary / primary-foreground | `#3b82f6` / `#f8fafc` |
| secondary / muted | `#141e33` / `#111b2e` |
| muted-foreground | `#8fa3c0` |
| accent / accent-foreground | `#17233d` / `#e6edf7` |
| destructive | `#f87171` |
| positive / positive-foreground | `#34d399` / `#052e1b` |
| border / input / ring | `#1e2a44` / `#2a3a5c` / `#3b82f6` |
| chart-line / chart-grid | `#38bdf8` / `rgba(148,163,184,0.18)` |
| chart-1…5 | `#38bdf8`, `#3b82f6`, `#6366f1`, `#22d3ee`, `#8b5cf6` |
| sidebar / sidebar-foreground | `#0a1120` / `#e6edf7` |
| sidebar-primary / accent | `#3b82f6` / `#17233d` |
| sidebar-border | `#1e2a44` |
| page-glow | `radial-gradient(1100px 520px at 12% -8%, #12203a 0%, transparent 62%)` |

### Typography, spacing, radii

- Sans: Geist (`--font-geist-sans`), loaded via `next/font/google`; mono: Geist Mono
  (`--font-geist-mono`, also used as `--font-mono`).
- Headings: `text-2xl font-semibold tracking-tight` page titles, `text-sm font-semibold` section
  titles, `text-xs font-semibold uppercase tracking-wide` card labels.
- Body: `text-sm`; hints: `text-xs text-muted-foreground`; numbers use `tabular-nums`.
- Spacing: 4px-based Tailwind scale; page gutters `px-6 py-8`; card padding `p-5`/`p-6`; gaps
  `gap-3`/`gap-4`/`gap-6`; content width `max-w-6xl`.
- Radii: `--radius: 0.625rem`; cards `rounded-xl`, controls `rounded-lg`, badges `rounded-full`.
- Shadows: `shadow-sm` on cards; borders carry most separation.
- Motion: `transition-colors` / `transition-transform` 200ms; reduced-motion override zeros
  durations; `focus-visible` gets 2px solid ring with 2px offset.
- Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`).

## Part 2 — Raw source

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-positive: var(--positive);
  --color-positive-foreground: var(--positive-foreground);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  color-scheme: light;
  --background: #f6f8fc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --secondary: #eef2f9;
  --secondary-foreground: #1e293b;
  --muted: #eef2f9;
  --muted-foreground: #64748b;
  --accent: #e8f0fe;
  --accent-foreground: #1d4ed8;
  --destructive: #dc2626;
  --positive: #059669;
  --positive-foreground: #ecfdf5;
  --border: #dce4f0;
  --input: #b9c6da;
  --ring: #2563eb;
  --chart-line: #2563eb;
  --chart-grid: #dce4f0;
  --chart-1: #2563eb;
  --chart-2: #0ea5e9;
  --chart-3: #10b981;
  --chart-4: #6366f1;
  --chart-5: #14b8a6;
  --radius: 0.625rem;
  --sidebar: #ffffff;
  --sidebar-foreground: #0f172a;
  --sidebar-primary: #2563eb;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e8f0fe;
  --sidebar-accent-foreground: #1d4ed8;
  --sidebar-border: #dce4f0;
  --sidebar-ring: #2563eb;
  --page-glow: radial-gradient(1100px 520px at 12% -8%, #dbeafe 0%, transparent 62%);
}

.dark {
  color-scheme: dark;
  --background: #070b14;
  --foreground: #e6edf7;
  --card: #0d1424;
  --card-foreground: #e6edf7;
  --popover: #0f1728;
  --popover-foreground: #e6edf7;
  --primary: #3b82f6;
  --primary-foreground: #f8fafc;
  --secondary: #141e33;
  --secondary-foreground: #dce6f5;
  --muted: #111b2e;
  --muted-foreground: #8fa3c0;
  --accent: #17233d;
  --accent-foreground: #e6edf7;
  --destructive: #f87171;
  --positive: #34d399;
  --positive-foreground: #052e1b;
  --border: #1e2a44;
  --input: #2a3a5c;
  --ring: #3b82f6;
  --chart-line: #38bdf8;
  --chart-grid: rgba(148, 163, 184, 0.18);
  --chart-1: #38bdf8;
  --chart-2: #3b82f6;
  --chart-3: #6366f1;
  --chart-4: #22d3ee;
  --chart-5: #8b5cf6;
  --sidebar: #0a1120;
  --sidebar-foreground: #e6edf7;
  --sidebar-primary: #3b82f6;
  --sidebar-primary-foreground: #f8fafc;
  --sidebar-accent: #17233d;
  --sidebar-accent-foreground: #e6edf7;
  --sidebar-border: #1e2a44;
  --sidebar-ring: #3b82f6;
  --page-glow: radial-gradient(1100px 520px at 12% -8%, #12203a 0%, transparent 62%);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    background-image: var(--page-glow);
    background-repeat: no-repeat;
  }
  html {
    @apply font-sans;
  }
  :where(a, button, input, select, textarea, [tabindex]):focus-visible {
    outline: 2px solid var(--ring) !important;
    outline-offset: 2px !important;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```
