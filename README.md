# Earnings Tracker

Personal, local-first web app for hourly workers: real hourly rate, month-to-date earnings, end-of-month projections,
and payment reconciliation in USD and BDT. Built from `earnings-tracker-prd.md` (v1.1).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (PRD §4 worked examples, cent for cent)
npm run e2e        # Playwright flows for the §10 acceptance criteria (uses installed Chrome)
npm run build      # production build + service worker (works offline, installable)
```

## Deploy (GitHub Pages)

Live at https://iamshihab2020.github.io/earningcalc/. To publish the current commit:

```bash
npm run deploy     # tests, builds with BASE_PATH=/<repo>/, force-pushes dist/ to the gh-pages branch
```

Pages is set to **Deploy from a branch: gh-pages /**. `.github/workflows/deploy.yml` is the Actions alternative; it
is manual-only while the account's Actions are blocked by a billing lock.

Data never leaves the browser: it lives in `localStorage` under `earnings-tracker:v1`, per browser and per device.
Use **Settings → Data → Export backup / Import backup** to move it between devices. All Pages sites of one account share the origin
`<user>.github.io`, so they can read each other's `localStorage`.

## Layout

- `src/engine/` — pure, framework-free calculation module. All money is integer cents; rates are integer
  ten-thousandths of a dollar; dates are `YYYY-MM-DD` strings. The UI only displays what this returns.
- `src/store/` — Zustand store persisted to `localStorage`, with item-level undo for every destructive action.
- `src/features/` — screens: dashboard, time log, payments, rate & schedule, what-if, share/export, settings.
- `e2e/` — Playwright flows.

## Decisions where the PRD was silent or contradictory

| Topic | Decision |
|---|---|
| Tracker card vs daily entries | One card per month. Tracked entries inside the card's date span are shown but not counted again; backfill and adjustments always count. |
| Tracker vs app figure | The card counts the tracker's earned figure by default; if the app's calculation differs, both are shown and the user can switch. |
| Derived rate precision | Suggest the shortest rate (2, then 3, then 4 decimals) that reproduces the tracker's total exactly. |
| Rate change modes | "From start of month" inserts a period on the 1st; "whole month" also removes other changes inside that month while keeping later months' rates. |
| Dates before the first rate | The earliest rate period also covers them. |
| BDT payments | Store the exchange rate used at the time, so later rate changes don't alter past reconciliations. |
| Today in projections | PRD default kept: remaining days start tomorrow ("Count today as worked" on). Worked example 2 assumes it off. |
