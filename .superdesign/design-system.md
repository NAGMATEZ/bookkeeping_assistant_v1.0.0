# Könyvelő asszisztens — Design System

## Product context

A Hungarian-first (HU default, EN toggle) bookkeeping assistant for freelancers and small teams.
It ingests invoices (PNG/JPEG/WEBP/PDF), OCRs them into structured data, and combines them with
manual/CSV/XLSX transactions to show cash position and 30/60/90-day projections.

Core JTBD:
1. Upload an invoice and verify the extracted vendor, dates, totals and line items.
2. Correct OCR mistakes before confirming an invoice.
3. See cash position, monthly net movement and a three-month moving-average forecast.
4. Import bank/card exports and keep one auditable ledger.
5. Export clean CSV/XLSX for an accountant.

Key routes: `/` dashboard, `/invoices`, `/transactions`, `/import`, `/export`, `/settings`.

## Superdesign source of truth

Project: `d6e68cb1-f9c2-46e9-9474-e0e88973f283` (Fintech UI Tervezés).

Canonical drafts:

- `706fc33f-75cc-45f4-93eb-94c66263d8ad` — Dashboard
- `b13b8fba-397a-44dd-b644-1b61d33f5a1f` — Invoices
- `1c556e4c-d090-49b7-922f-513b17d49de5` — Transactions
- `ed2f7d8b-1f5f-4fc9-b9bd-63deb8030dab` — Import Step 1
- `279fd747-3df3-483a-b820-4a33bb4166a2` — Import Step 2
- `0ff6d3e7-aeb7-450c-81bb-02bee8da698b` — Import Confirmation
- `bda5b77b-dfab-4518-b33c-b31de0ca658b` — Settings

Ignored drafts (do not use as design input): `ac3bbc84-b879-4a4f-8382-d48149a636cb` (wrong baseline) and `c5fb4f72-9f13-4f7e-aeff-caecf0d947de` (rejected by the user).

The canvas supplies structure and interaction patterns; this app keeps its existing dark-mode palette and semantic tokens, so canvas colors are translated through `bg-card`, `text-foreground`, `border-border`, `bg-primary`, etc. Do not hardcode canvas grays/indigos into components.

## Brand & visual direction

Professional B2B fintech, calm and data-dense (Mercury/Linear lineage), not playful. The palette is
blue-forward: light mode is a cool blue/white workspace with emerald as the positive/success accent;
dark mode is near-black navy with electric blue primary and cyan chart accents. Cards use thin
borders + `shadow-sm` rather than heavy elevation. Content is left-aligned in a `max-w-6xl` column;
the sidebar is a persistent 16rem rail on desktop and a drawer on mobile.

### Color tokens (semantic, Tailwind utilities)

| Role | Light | Dark |
| --- | --- | --- |
| background | `#f6f8fc` | `#070b14` |
| foreground | `#0f172a` | `#e6edf7` |
| card / popover | `#ffffff` | `#0d1424` / `#0f1728` |
| primary / on-primary | `#2563eb` / `#ffffff` | `#3b82f6` / `#f8fafc` |
| secondary / muted | `#eef2f9` | `#141e33` / `#111b2e` |
| muted-foreground | `#64748b` | `#8fa3c0` |
| accent / on-accent | `#e8f0fe` / `#1d4ed8` | `#17233d` / `#e6edf7` |
| destructive | `#dc2626` | `#f87171` |
| positive / on-positive | `#059669` / `#ecfdf5` | `#34d399` / `#052e1b` |
| border / input / ring | `#dce4f0` / `#b9c6da` / `#2563eb` | `#1e2a44` / `#2a3a5c` / `#3b82f6` |
| sidebar | `#ffffff` | `#0a1120` |
| chart line / grid | `#2563eb` / `#dce4f0` | `#38bdf8` / `rgba(148,163,184,.18)` |
| chart 1–5 | `#2563eb #0ea5e9 #10b981 #6366f1 #14b8a6` | `#38bdf8 #3b82f6 #6366f1 #22d3ee #8b5cf6` |

Page background adds a soft radial glow: light `#dbeafe` at top-left, dark `#12203a`.

Status usage: emerald = confirmed/positive, amber = needs review/warning, sky = informational
(multicurrency), red = destructive/error. Badges are `rounded-full`, `text-xs font-medium`,
`px-2 py-0.5`.

### Typography

- Sans: Geist; Mono: Geist Mono. No serif or decorative fonts.
- Page title: `text-2xl font-semibold tracking-tight`.
- Section title: `text-sm font-semibold`; card label: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`.
- Body/controls: `text-sm`; hints/errors: `text-xs`/`text-sm`.
- All money and dates use `tabular-nums`; money is locale-formatted (`formatMoney`), HUF with symbol after.

### Spacing, shape, layout

- 4px Tailwind scale. Page: `px-6 py-8`, `max-w-6xl mx-auto`; vertical rhythm `space-y-6`/`gap-6`.
- Cards: `rounded-xl border border-border bg-card p-5 shadow-sm`.
- Controls: `h-9 rounded-lg border border-input bg-background px-3 text-sm`.
- Sidebar: `w-64`, `border-r border-sidebar-border bg-sidebar`; active nav item = primary pill.
- Tables: full-width, `text-sm`, header `text-xs uppercase tracking-wide text-muted-foreground`,
  rows divided by `border-border/60`, numeric columns right-aligned.
- Focus: 2px solid ring, 2px offset, visible on all interactive elements.

### Motion

Subtle: `transition-colors`/`transition-transform` at 200ms. No bounces or decorative animation.
Respect `prefers-reduced-motion` (durations reduced to near-zero).

## Component rules

- Use only the tokens above through Tailwind semantic utilities (`bg-card`, `text-muted-foreground`,
  `border-border`, `bg-primary`); never hardcode zinc/slate/white palettes.
- Primary action = filled `bg-primary`; secondary = `variant="outline"`; destructive = tinted
  destructive variant. All controls use the shared `Button`.
- Data density is a feature: compact rows, truncation with `title` tooltips, right-aligned money.
- Every input has a visible label (or `sr-only` label), and every async action exposes error/success
  feedback in text (not color alone).
- Empty states are plain bordered/dashed surfaces with one clear next action.

## Accessibility requirements

- WCAG AA contrast in both themes; status never conveyed by color alone (text labels accompany badges).
- Table regions are scrollable and named; tables have captions; actions have explicit labels.
- Drawer is inert when closed; skip link targets a focusable `main`.

## Invoices review screen

Existing structure: upload card → GET filter form → table (date, vendor, project, net, VAT, gross,
status, actions). Expanding a row opens an inline review panel with a totals form (net/VAT/gross +
save) and a source-file panel. AI-extracted line items are editable before save, with an
always-visible image/PDF preview beside the line items for verification.

## Import flow

`/import` is a three-step wizard that follows the canvas: upload file → map columns and preview rows
→ review and confirm. Step 2 uses the real preview endpoint and keeps per-row direction overrides;
step 3 calls the real import endpoint and reports inserted and skipped rows. The previous redirect
from `/import` and the duplicated import/export sections on `/transactions` were removed.
