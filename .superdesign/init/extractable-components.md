# Extractable Components

## Sidebar

- Source: `src/components/layout/sidebar.tsx`
- Category: layout
- Description: Persistent app navigation with brand, active-route pill, theme toggle, HU/EN selector, settings entry, and mobile drawer.
- Extractable props: `initialTheme` (`light` | `dark`, default `light`); `activeHref` (string, default `/`)
- Hardcoded: brand label (localized key), nav item order/icons/labels, lucide icons, all CSS, cookie side effects.

## AppShell

- Source: `src/app/layout.tsx`
- Category: layout
- Description: Root shell combining sidebar, skip link, and main content column on the page glow background.
- Extractable props: none (locale/theme are cookie-driven; use `locale` and `theme` for static preview)
- Hardcoded: font variables, guardrail branch, all CSS.
