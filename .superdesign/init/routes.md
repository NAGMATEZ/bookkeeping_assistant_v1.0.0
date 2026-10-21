# Routes

File-based Next.js App Router (all pages dynamic; locale/theme read from cookies).

| URL | Entry file | Layout | Renders |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | root (`src/app/layout.tsx`) | Dashboard: 4 KPI cards (pending invoices, monthly net delta, current position, 3-month moving average) + position projection chart + footnote. |
| `/invoices` | `src/app/invoices/page.tsx` | root | Invoice list: upload form, GET filter form (status/project/vendor), data table with expandable review panel (net/VAT/gross editing + source image), confirm/delete actions, mismatch + multicurrency badges. |
| `/transactions` | `src/app/transactions/page.tsx` | root | Manual transaction form, filters, transaction table with signed/colored amounts and delete. |
| `/import` | `src/app/import/page.tsx` | root | Three-step import wizard: upload, map columns/preview, review/confirm; wired to `/api/import/preview` and `/api/import`. |
| `/export` | `src/app/export/page.tsx` | root | CSV / XLSX export landing page with download links. |
| `/settings` | `src/app/settings/page.tsx` | root | Settings form (currency, opening balance, LLM provider/API keys), language selector, reset panel. |

## API routes

- `POST /api/invoices` — upload + OCR pipeline (`src/app/api/invoices/route.ts`)
- `PATCH|DELETE /api/invoices/[id]` — edit net/VAT/gross or delete (`src/app/api/invoices/[id]/route.ts`)
- `POST /api/invoices/[id]/confirm` — confirm invoice
- `GET /api/invoices/[id]/image` — stream stored source image/PDF
- `GET|POST /api/transactions`, `DELETE /api/transactions/[id]`
- `POST /api/import/preview`, `POST /api/import`
- `GET /api/export?format=csv|xlsx`
- `GET|POST /api/settings`, `POST /api/reset`
