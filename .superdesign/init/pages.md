# Page Dependency Trees

All pages inherit the root layout:

- `src/app/layout.tsx`
  - `src/components/layout/sidebar.tsx`
    - `src/components/layout/i18n-provider.tsx`
    - `src/lib/i18n.ts`
    - `src/lib/preferences.ts`
    - `src/lib/utils.ts`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/layout/guardrail-screen.tsx`
  - `src/lib/preferences.ts`
  - `src/lib/startup-gate.ts`
  - `src/app/globals.css`

## /invoices

Entry: `src/app/invoices/page.tsx`

- `src/components/invoices/invoice-table.tsx`
  - `src/components/ui/button.tsx`
    - `src/lib/utils.ts`
  - `src/components/layout/i18n-provider.tsx`
  - `src/lib/format.ts`
  - `src/lib/money.ts`
  - `src/lib/utils.ts`
- `src/components/invoices/invoice-upload-form.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/ui/button.tsx`
- `src/lib/dates.ts`
- `src/lib/i18n.ts`
- `src/lib/invoice-parse.ts`
- `src/lib/invoices.ts`
- `src/lib/preferences.ts`
- `src/lib/settings.ts`

## /

Entry: `src/app/page.tsx`

- `src/components/dashboard/projection-chart.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/lib/format.ts`
  - `src/lib/i18n.ts`
- `src/components/layout/guardrail-screen.tsx`
- `src/lib/dashboard.ts`
- `src/lib/format.ts`
- `src/lib/i18n.ts`
- `src/lib/preferences.ts`
- `src/lib/settings.ts`

## /transactions

Entry: `src/app/transactions/page.tsx`

- `src/components/transactions/manual-entry-form.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/ui/button.tsx`
  - `src/lib/money.ts`
- `src/components/transactions/transaction-table.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/ui/button.tsx`
  - `src/lib/format.ts`
- `src/lib/dates.ts`
- `src/lib/i18n.ts`
- `src/lib/preferences.ts`
- `src/lib/transactions.ts`

## /import

Entry: `src/app/import/page.tsx`

- `src/components/import/import-wizard.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/ui/button.tsx`
  - `src/lib/i18n.ts`
  - `src/lib/utils.ts`
- `src/lib/i18n.ts`
- `src/lib/preferences.ts`

## /settings

Entry: `src/app/settings/page.tsx`

- `src/components/settings/settings-form.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/ui/button.tsx`
- `src/components/settings/language-selector.tsx`
  - `src/components/layout/i18n-provider.tsx`
- `src/components/settings/reset-panel.tsx`
  - `src/components/layout/i18n-provider.tsx`
  - `src/components/ui/button.tsx`
- `src/lib/i18n.ts`
- `src/lib/money.ts`
- `src/lib/preferences.ts`
- `src/lib/settings.ts`

## /export

Entry: `src/app/export/page.tsx`

- `src/lib/i18n.ts`
- `src/lib/preferences.ts`
