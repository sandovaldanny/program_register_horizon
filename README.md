# Horizon Care Tracker

Care-coordination tool for the **Alkalma Horizon** Anxiety & Depression programme, serving the Al Falah and Al Bateen centers.

Built for Care Coordinators and Case Management: open the dashboard and immediately see who needs a call, a screening or a clinician review. Monthly PHQ-9 / GAD-7 tracking, four clear alert rules, a transparent priority score, and a shared database so the whole team works from the same list.

**Production:** https://programregisterhorizon.vercel.app
**Business rules:** [docs/RULES.md](docs/RULES.md) (English) · [docs/REGLAS.md](docs/REGLAS.md) (Spanish)

---

## Contents

- [Features](#features)
- [Clinical rules at a glance](#clinical-rules-at-a-glance)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Database](#database)
- [One-time Excel import](#one-time-excel-import)
- [Deployment](#deployment)
- [Project layout](#project-layout)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Security and privacy](#security-and-privacy)
- [Documentation](#documentation)

---

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Eight KPI tiles (Active, Needs attention, Worsening, No score, No session, No baseline, Improving, Graduation candidates) above a single caseload table. Each tile filters the table on click. |
| **Caseload table** | Inline filters (search, alert, PHQ-9 / GAD-7 severity, clinician, manual priority, status), sortable headers, `baseline → latest` with delta chip and severity badge per scale, alert chips, priority with explanatory tooltip. Filters live in the URL and are shareable. |
| **Center scope** | Switch between Al Falah, Al Bateen or both; persisted per user. |
| **Patient page** | Timeline chart of every PHQ-9 / GAD-7 with severity bands, full screening history (editable score and date, estimated dates flagged), quick-add score, individual goals, notes log, enrolment card, sessions split by psychology / psychiatry, clinical and attendance details. |
| **Screenings** | Every score is kept as its own dated row. Delta and trend always compare baseline → latest. Dates are editable so imported estimates can be corrected. |
| **Four alert rules** | Worsening · No score > 1 month · No session > 1 month · No baseline. Only enrolled patients raise alerts. |
| **Enrolment** | Every patient carries an enrolment date. Unenrolling requires a date and a reason from the catalogue; unenrolled patients drop out of alerts, KPIs and the default list, and can be re-enrolled. |
| **Priority score** | Sum of rule weights (40 / 30 / 30 / 20) plus +20 for a manual "High" follow-up priority; ties go to the longest overdue. Zero when nothing is pending. |
| **Settings** | Clinicians catalogue (name, specialty, center), diagnosis / care-plan / goal-category / unenrolment-reason pick-lists, change thresholds, screening interval and no-session window. Patient forms are catalogue-only (no free text, no "Other"). |
| **Individual goals** | Per-patient goals with category, target date and open / achieved / dropped status, separate from the medical care plan. |
| **Export** | CSV or Excel of the current filtered view with all derived columns. |
| **Languages** | English, Spanish and Arabic (RTL) with a one-click toggle. |
| **Branding** | Alkalma visual identity: Indigo / Turquoise palette, Montserrat and Tajawal. |

---

## Clinical rules at a glance

Full detail, worked examples and source code in [docs/RULES.md](docs/RULES.md).

**Severity (latest score per scale)**

| PHQ-9 | Band | GAD-7 | Band |
|---|---|---|---|
| 0–4 | Minimal | 0–4 | Minimal |
| 5–9 | Mild | 5–9 | Mild |
| 10–14 | Moderate | 10–14 | Moderate |
| 15–19 | Moderately severe | 15+ | Severe |
| 20–27 | Severe | | |

"Severe range" = either scale ≥ 15. Shown as information, not an alert.

**Trend** = latest − baseline against a configurable threshold (PHQ-9 ≥ 5, GAD-7 ≥ 4 by default): improving / stable / worsening per scale; `mixed` when the scales disagree.

**The four rules (enrolled patients only)**

| Rule | Condition | Weight |
|---|---|---|
| Worsening | baseline → latest rose by the threshold on any scale | 40 |
| No score > 1 month | more than one screening interval since the last score (re-raised every interval) | 30 |
| No session > 1 month | more than N days since the last session | 30 |
| No baseline | no PHQ-9 / GAD-7 recorded at all | 20 |

**Priority** = sum of active weights + 20 if manual priority is High + `min(days past due, 90) / 100` as tie-breaker. No rules → 0.

**Information only:** severity, Improving, Graduation candidate (all latest scores < 5), manual follow-up priority.

---

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Server Components, Server Actions) |
| Styling | Tailwind CSS v4 with Alkalma design tokens |
| Database | Neon Postgres via the Vercel Marketplace, Drizzle ORM (`neon-http` driver) |
| Auth | Single admin account, HS256 JWT session cookie (`jose`), route gate in `src/proxy.ts` |
| i18n | next-intl 4, cookie-based locale, `<html lang dir>` switching, Tajawal for Arabic |
| Charts | Recharts 3 |
| Validation | zod 4 |
| Tests | vitest (metrics and import mappers) |
| Hosting | Vercel |

Design principles:

- **Pure metrics.** Everything derived (severity, trend, alerts, priority, KPIs) is computed at read time in `src/lib/metrics/` from raw rows plus the current Settings. Nothing derived is stored, so changing a threshold applies instantly to every patient.
- **One entry point.** `derivePatient()` feeds the dashboard, patient page and export. No duplicated calculations.
- **Catalogue-driven forms.** Clinicians, diagnoses, care plans and goal categories are managed in Settings; patient forms only accept catalogue values.
- **The app is the source of truth.** The Excel import ran once; every correction is made in the app.

---

## Getting started

Requirements: Node.js 20+, npm, a Vercel account with access to the project (for the Neon connection string).

```bash
git clone https://github.com/sandovaldanny/Program_register_horizon.git
cd Program_register_horizon
npm install

# Pull DATABASE_URL from the Vercel project
vercel link
vercel env pull .env.local

# Add the remaining variables to .env.local (see .env.example)
#   ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET

npm run db:migrate     # apply drizzle/ migrations
npm run dev            # http://localhost:3000
```

Quality checks:

```bash
npm test               # vitest (100 cases)
npm run lint           # eslint
npm run build          # production build
```

---

## Database

Schema lives in `src/db/schema.ts`; migrations are generated into `drizzle/` and committed.

| Table | Purpose |
|---|---|
| `patients` | Union of both centers' fields; unique on `(center, mrn)`; enrolled / unenrolled with dates and reason; sessions split by specialty |
| `assessments` | One row per PHQ-9 / GAD-7 score with date, `date_source` (recorded / estimated), note; range checks per scale |
| `notes` | Notes, actions, MDT entries and import provenance |
| `goals` | Individual goals per patient (title, category, target date, status) |
| `clinicians` | Clinician catalogue (name, specialty, center, active) |
| `catalog_items` | Diagnosis, care-plan, goal-category and unenrolment-reason pick-lists |
| `settings` | Single row: change thresholds, screening interval, no-session window |

Workflow after a schema change:

```bash
npm run db:generate    # write a new migration into drizzle/
npm run db:migrate     # apply it to the database in DATABASE_URL
npm run db:studio      # optional: browse the data
```

Migrations are applied from a developer machine, never during the Vercel build.

---

## One-time Excel import

The source workbooks live in `data/`, which is git-ignored because some sheets are not anonymized. The importer reads **only** the agreed sheet of each file (`September 26` for Al Falah, `Register` for Al Bateen).

```bash
# Preview without writing
npm run import:excel -- --file "data/PHM review - al falah.xlsx" --center al_falah --dry-run

# Import
npm run import:excel -- --file "data/PHM review - al falah.xlsx" --center al_falah
npm run import:excel -- --file "data/Care_Coordinator_Tracker - al batten.xlsx" --center al_bateen
```

| Flag | Effect |
|---|---|
| `--dry-run` | Report counts and anomalies, write nothing |
| `--reset` | Delete that center's patients first |
| `--skip-notes` | Do not import free-text notes |

Re-running is a no-op for existing MRNs. Baseline and latest scores share the sheet date; the baseline is flagged *estimated* and can be corrected in the app. Date rules per case are documented in [docs/RULES.md §17](docs/RULES.md#17-excel-import-rules-one-time).

---

## Deployment

The project is linked to Vercel (`program_register_horizon`). Pushes to `main` can be deployed with:

```bash
vercel deploy          # preview (behind Vercel SSO)
vercel deploy --prod   # production
```

Before the first deployment set `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `SESSION_SECRET` in the Vercel project (Production and Preview). `DATABASE_URL` is injected by the Neon integration. Run `npm run db:migrate` locally against the production database whenever a new migration is added.

---

## Project layout

```
src/
  app/
    login/                    admin login
    (app)/                    authenticated shell (sidebar, center scope, language toggle)
      page.tsx                dashboard: KPIs + filterable, sortable caseload
      patients/new            create patient
      patients/[id]           patient page: chart, screenings, goals, notes
      patients/[id]/edit      edit patient
      settings/               clinicians, catalogues, clinical rules
    api/export/               CSV / XLSX of the current view
  actions/                    server actions (auth, patients, assessments, notes, goals, settings, catalogues)
  components/                 UI (PatientTable, CaseloadFilters, KpiTile, AssessmentChart, GoalsPanel, …)
  db/                         Drizzle schema, lazy Neon client, queries
  lib/
    metrics/                  pure, tested: severity, trend, alerts, flags, priority, derive
    import/                   Excel row mappers and normalizers (tested)
    auth/                     session helpers
    filters.ts                caseload filter parsing and sorting
    validation.ts             zod schemas
  i18n/                       next-intl request config
  proxy.ts                    session gate
messages/{en,es,ar}.json      translations
drizzle/                      SQL migrations
scripts/import-excel.ts       one-time import CLI
docs/                         business rules (EN / ES)
```

---

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string (set by the Vercel integration) |
| `ADMIN_USERNAME` | yes | Admin login |
| `ADMIN_PASSWORD` | yes | Admin password |
| `SESSION_SECRET` | yes | ≥ 32 random characters; signs the session cookie (`openssl rand -base64 48`) |

See `.env.example`. Never commit `.env.local`.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` / `npm run test:watch` | Unit tests |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (development only) |
| `npm run db:studio` | Drizzle Studio |
| `npm run import:excel` | Excel importer (see above) |

---

## Security and privacy

- All routes except `/login` require a valid session; the gate runs in `src/proxy.ts` and every page and action calls `requireSession()`.
- Password comparison is constant-time (SHA-256 digests + `timingSafeEqual`). Session cookies are httpOnly, secure and expire after 12 hours.
- Change the default admin credentials before sharing the production URL.
- `data/` and `.env*` are git-ignored. Only anonymized sheets are ever read by the importer; sheets containing real identifiers are never opened.
- Note bodies are never written to logs.

---

## Documentation

- [docs/RULES.md](docs/RULES.md) — business rules, worked examples and the source of every rule (English)
- [docs/REGLAS.md](docs/REGLAS.md) — the same in Spanish
- `.env.example` — environment template
