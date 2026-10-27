# Wind Forecast Desk – frontend

React 18 + TypeScript + Vite single-page app for the day-ahead trading desk. It calls the
backend API described in [`docs/API.md`](../docs/API.md); there is no mock data in the bundle.

## Views

A dashboard layout: a sidebar with four views, a top bar with the global filters (delivery range or
decision date, and the gate-closure cutoff) and a light/dark toggle, then a row of KPI cards and a
grid of chart cards. Any day in a chart, ranking or table opens that day's decision.

- **Overview** (default) – the month at a glance: six KPI cards with sparklines (MAE, bias,
  bias-corrected MAE, band coverage, skill vs persistence, energy shortfall), forecast vs actual, an
  "at a glance" panel (over/under split, RMSE, P90 error, worst hour), a day x hour error heatmap, a
  model leaderboard (P50, forecast, persistence, same hour D-2), daily error, cumulative forecast vs
  actual energy, a ranked list of the worst delivery days, and a forecast vs actual scatter.
- **Day-ahead decision** – a strip of every delivery day coloured by its bias, eight KPI cards
  (expected P50 energy, published forecast, extra cover down to P10, low/peak, actual energy, day
  MAE, hours inside the band, forecast run age), the hourly P50 line and P10–P90 band against the
  published forecast and actuals, a "decision ticket" (which run was used and why), how successive
  runs moved, the hourly error, and the full hourly table with CSV export (UTF-8 with BOM for Excel).
- **Forecast accuracy** – nine KPI cards and the deep-dive charts: lead time, bias by forecast level,
  error distribution, hour of day, daily error, and every metric for all four models side by side.
  When the bias is large, an alert explains its likely cause. Each chart has a Chart / Table toggle.
- **Data explorer** – every delivery hour in a sortable, paginated table, filtered by direction, error
  size, day and hour, with live MAE/bias for the selection and CSV export of the filtered rows.

Each chart card ends with a "For buying" line on what it means for the decision. View, cutoff and
dates are kept in the URL query string, so a view can be bookmarked or shared.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run build      # type-check (tsc -b) + production build into dist/
npm run lint
npm test           # unit tests for chart/KPI/dashboard data shaping and CSV (Node's built-in runner with type stripping, Node >= 22.18)
```

`VITE_API_BASE` (build time) sets the API origin. Leave it unset when the backend serves the
built files, so requests go to the same origin.

## Layout

```
src/
  api/          types mirroring docs/API.md, fetch client with typed ApiError
  hooks/        data hooks (shared request cache, keep last data while refetching), URL state,
                chart theme, light/dark toggle
  lib/          formatting (MW/GW, MWh/GWh, Europe/London times), date maths, CSV export,
                chartData.ts and dashboard.ts: pure data shaping (no runtime imports, unit-tested)
  components/   shell (sidebar, top bar), stat card, chart card, sparkline, widgets (split bar,
                fact list, worst-days ranking, day strip), tables, controls, loading/error states
  components/charts/  Recharts charts plus the SVG/CSS error heatmap
  pages/        OverviewPage, DecisionPage, AccuracyPage, ExplorerPage
  styles.css    design tokens (light and dark via prefers-color-scheme) and component styles
tests/          node:test unit tests for src/lib
```

## Design

An analytics dashboard: a dark navy sidebar, cards on a light grey page (or a near-black page in
dark mode), one accented lead KPI per view, and a 12-column card grid that collapses to one column
on tablets and phones (the sidebar becomes a top bar under 900px).

- **Tokens**: everything lives in `src/styles.css` `:root` (surfaces, lines, ink, accent, chart
  series, heatmap ramp, status pills). Dark values are redefined under `prefers-color-scheme: dark`
  and under `data-theme`, which the theme toggle sets (remembered per browser). Charts read the same
  tokens through `src/lib/theme.ts` and re-read them when the theme changes.
- **Type**: Archivo Variable, self-hosted via `@fontsource-variable/archivo`. No UI framework.
- **Colour**: blue = the forecast you buy against, orange = actual, aqua = bias-corrected P50, grey
  = naive baselines and error size, red/blue = over/under-forecast. The blue/orange/aqua set was
  checked with a colour-vision-deficiency validator (all pairs, light and dark). Status pills always
  pair colour with a glyph and text, and the heatmap uses a diverging blue–grey–red ramp.
- **Accessibility**: keyboard-accessible tooltips, a table view for every breakdown, `aria-pressed`
  toggles, sortable headers with `aria-sort`, a skip link, and no horizontal scroll at 390px.
