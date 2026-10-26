# Wind Forecast Desk – frontend

React 18 + TypeScript + Vite single-page app for the day-ahead trading desk. It calls the
backend API described in [`docs/API.md`](../docs/API.md); there is no mock data in the bundle.

## Views

- **Day-ahead decision** – pick the decision date (delivery is the next day). Shows which forecast
  run was the latest at the cutoff, energy KPIs (expected P50 energy, published forecast and its
  offset from P50, extra cover down to P10, forecast low/peak, realised actual and how many hours fell
  inside the band), the hourly bias-corrected P50 line and P10–P90 band against the published
  forecast and actuals, how successive runs moved (on the same hour-step axis), and an hourly table
  with CSV export (UTF-8 with BOM so Excel reads it correctly).
- **Forecast accuracy** – for a delivery-date range at the chosen cutoff: MAE, RMSE, bias, P90
  absolute error, nMAE, skill against persistence and same-hour-D-2 baselines, and a backtest of
  the P10–P90 band coverage. When the bias is large, a callout explains its likely cause. Charts
  cover forecast vs actual, lead time (MAE and bias), bias by forecast level, day, hour of day and the
  error distribution, plus a bias-corrected (P50) MAE tile. Each chart says what
  it means for buying.

The cutoff selector in the header applies to both views. View, cutoff and dates are kept in the URL
query string, so a view can be bookmarked or shared.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run build      # type-check (tsc -b) + production build into dist/
npm run lint
npm test           # unit tests for chart/KPI data shaping and CSV (Node's built-in runner with type stripping, Node >= 22.18)
```

`VITE_API_BASE` (build time) sets the API origin. Leave it unset when the backend serves the
built files, so requests go to the same origin.

## Layout

```
src/
  api/          types mirroring docs/API.md, fetch client with typed ApiError
  hooks/        data hooks (abortable, keep last data while refetching), URL state, chart theme
  lib/          formatting (MW/GW, MWh/GWh, Europe/London times), date maths, CSV export,
                chartData.ts: pure chart/KPI data shaping (no runtime imports, unit-tested)
  components/   header, controls, KPI tile, chart card, tables, loading and error states
  components/charts/  Recharts charts
  pages/        DecisionPage, AccuracyPage
  styles.css    design tokens (light and dark via prefers-color-scheme) and component styles
tests/          node:test unit tests for src/lib
```

Chart colours follow a colour-blind-checked palette: blue = forecast (solid P50, dashed published),
orange = actual, grey = error size (MAE), red/blue = over/under-forecast. Charts have keyboard-accessible tooltips; the hourly decision data
and the accuracy breakdowns also have data tables.
