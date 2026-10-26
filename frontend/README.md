# Wind Forecast Desk – frontend

React 18 + TypeScript + Vite single-page app for the day-ahead trading desk. It calls the
backend API described in [`docs/API.md`](../docs/API.md); there is no mock data in the bundle.

## Views

- **Day-ahead decision** – pick the decision date (delivery is the next day). Shows which forecast
  run was the latest at the cutoff, energy KPIs (forecast, P10 low-wind case, P90 shortfall risk,
  min/max hour, realised actual for the backtest), the hourly forecast with its P10–P90 band against
  actuals, how successive runs moved, and an hourly table with CSV export.
- **Forecast accuracy** – for a delivery-date range at the chosen cutoff: MAE, RMSE, bias, P90
  absolute error, nMAE and skill against persistence and same-hour-D-2 baselines, plus charts by
  lead time, hour of day, day, and the error distribution. Each chart says what it means for buying.

The cutoff selector in the header applies to both views. View, cutoff and dates are kept in the URL
query string, so a view can be bookmarked or shared.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run build      # type-check (tsc -b) + production build into dist/
npm run lint
```

`VITE_API_BASE` (build time) sets the API origin. Leave it unset when the backend serves the
built files, so requests go to the same origin.

## Layout

```
src/
  api/          types mirroring docs/API.md, fetch client with typed ApiError
  hooks/        data hooks (abortable, keep last data while refetching), URL state, chart theme
  lib/          formatting (MW/GW, MWh/GWh, Europe/London times), date maths, CSV export
  components/   header, controls, KPI tile, chart card, tables, loading and error states
  components/charts/  Recharts charts
  pages/        DecisionPage, AccuracyPage
  styles.css    design tokens (light and dark via prefers-color-scheme) and component styles
```

Chart colours follow a colour-blind-checked palette: blue = forecast, orange = actual,
red/blue = over/under-forecast. Charts have keyboard-accessible tooltips; the hourly decision data
and the accuracy breakdowns also have data tables.
