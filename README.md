# Horizon Care Tracker

Care-coordination tracker for the Alkalma **Horizon** Anxiety & Depression programme (Al Falah and Al Bateen). Built for Care Coordinators and Case Management: open the dashboard and immediately see who needs a call, a screening or a clinician review.

- **PHQ-9 / GAD-7 monthly tracking** – every screening is kept; delta and trend always compare baseline → latest.
- **Alerts** – assessment overdue (no score in the last month, re-raised every month), attendance concern (no session in the last month), worsening, severe, no scores, confirm still active, minimal scores (discuss graduation).
- **Severity per scale** – PHQ-9 0–4 minimal · 5–9 mild · 10–14 moderate · 15–19 moderately severe · 20+ severe. GAD-7 0–4 minimal · 5–9 mild · 10–14 moderate · 15+ severe. "Severe range" = either scale ≥15. No tiers.
- **Configurable in Settings** – clinicians catalogue (name, specialty, center), diagnosis and care-plan pick-lists (catalogue-only in the patient form), change thresholds (default PHQ ≥5, GAD ≥4), screening interval, due-soon window, confirm-active and attendance windows.
- **Trilingual UI** – English, Spanish, Arabic (RTL).
- **Export** – CSV / Excel of the filtered caseload with derived columns.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Neon Postgres via Vercel Marketplace · Drizzle ORM · next-intl · Recharts · vitest. Deployed on Vercel.

## Local development

```bash
npm install
vercel link && vercel env pull .env.local     # DATABASE_URL from the Neon integration
# add to .env.local: ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET (see .env.example)
npm run db:migrate                            # apply drizzle/ migrations
npm run dev
```

Tests: `npm test`. Lint: `npm run lint`.

## Data import (one-time)

Source workbooks live in `data/` (git-ignored; some sheets are not anonymized and must never be committed). Only the agreed sheet of each file is read.

```bash
npm run import:excel -- --file "data/PHM review - al falah.xlsx" --center al_falah --dry-run
npm run import:excel -- --file "data/Care_Coordinator_Tracker - al batten.xlsx" --center al_bateen
```

Flags: `--dry-run` (report only), `--reset` (delete that center first), `--skip-notes` (do not import free-text notes). Re-running is a no-op for existing MRNs. Baseline and latest scores share the sheet's date; the baseline is flagged *estimated* and can be corrected in the app.

## Project layout

```
src/app/(app)/            dashboard (KPIs + filterable, sortable caseload), patients/new, patients/[id], settings
src/app/api/export        CSV / XLSX
src/lib/metrics           pure, tested: severity, tier, trend, alerts, flags, priority
src/lib/import            Excel row mappers + normalizers (tested)
src/db                    Drizzle schema, lazy Neon client, queries
src/actions               server actions (auth, patients, assessments, notes, settings)
src/proxy.ts              session gate
messages/{en,es,ar}.json  translations
scripts/import-excel.ts   one-time import CLI
```

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (set by the Vercel integration) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | single admin login |
| `SESSION_SECRET` | ≥32 chars, signs the session cookie |

Migrations are applied locally (`npm run db:migrate`), never in the Vercel build.
