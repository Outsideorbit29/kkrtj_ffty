/** Response types for the backend API. Mirrors docs/API.md; keep the two in sync. */

/** ISO-8601 UTC timestamp ending in `Z`. */
export type IsoUtc = string;
/** Europe/London calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Wall-clock time, `HH:MM`. */
export type HhMm = string;

export interface CutoffPreset {
  label: string;
  value: HhMm;
}

export interface Meta {
  deliveryStart: IsoDate;
  deliveryEnd: IsoDate;
  decisionStart: IsoDate;
  decisionEnd: IsoDate;
  defaultCutoff: HhMm;
  cutoffPresets: CutoffPreset[];
  forecastRunTimesUtc: HhMm[];
  dataSource: string;
  snapshotCreatedUtc: IsoUtc | null;
  timezone: string;
}

/**
 * Forecast fields are null for hours the decision run does not reach (cutoffs before the
 * 02:30 UTC run on D-1 leave the last hours of D uncovered); `p10`/`p50`/`p90` are also null
 * when there is too little error history for a band. `p50` is the bias-corrected central estimate,
 * `max(0, forecast - q50(error))` from the same trailing window as the band.
 */
export interface HourlyRow {
  startTime: IsoUtc;
  forecast: number | null;
  p50: number | null;
  p10: number | null;
  p90: number | null;
  actual: number | null;
  error: number | null;
  horizonHours: number | null;
}

export interface HalfHourlyActual {
  startTime: IsoUtc;
  generation: number;
}

export interface PowerAt {
  startTime: IsoUtc;
  mw: number;
}

export interface DecisionSummary {
  forecastMWh: number;
  /** Null when actuals for D are not (yet) available. */
  actualMWh: number | null;
  errorMWh: number | null;
  minForecast: PowerAt;
  maxForecast: PowerAt;
  shortfallP90MWh: number | null;
  /** Sum of hourly P50s (optional in the contract; the UI falls back to summing `hourly`). */
  p50MWh?: number | null;
  mae: number | null;
  bias: number | null;
}

export interface RunPoint {
  startTime: IsoUtc;
  forecast: number;
}

export interface ForecastRun {
  publishTimeUtc: IsoUtc;
  availableAtDecision: boolean;
  isDecisionRun: boolean;
  points: RunPoint[];
}

export interface Decision {
  deliveryDate: IsoDate;
  decisionDate: IsoDate;
  cutoff: HhMm;
  decisionTimeUtc: IsoUtc;
  forecastPublishTimeUtc: IsoUtc;
  forecastAgeMinutes: number;
  bandMethod: string;
  hourly: HourlyRow[];
  actualHalfHourly: HalfHourlyActual[];
  summary: DecisionSummary;
  runs: ForecastRun[];
}

/** All values in MW except `n` (hour count) and `nmae_pct` (percent). */
export interface ErrorMetrics {
  n: number;
  mae: number;
  rmse: number;
  bias: number;
  nmae_pct: number;
  p10_error: number;
  p50_error: number;
  p90_error: number;
  p90_abs_error: number;
  max_abs_error: number;
  mean_actual: number;
}

export interface HorizonBucket {
  bucket: string;
  horizonFrom: number;
  horizonTo: number;
  n: number;
  mae: number;
  rmse: number;
  bias: number;
}

export interface HourOfDayStat {
  hour: number;
  n: number;
  mae: number;
  bias: number;
}

export interface DayStat {
  date: IsoDate;
  mae: number;
  bias: number;
  forecastMWh: number;
  actualMWh: number;
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

/** Every hour with a decision-time forecast; `actual`/`error` are null where outturn is missing. */
export interface SeriesPoint {
  startTime: IsoUtc;
  forecast: number;
  actual: number | null;
  error: number | null;
  horizonHours: number;
}

export interface Accuracy {
  start: IsoDate;
  end: IsoDate;
  cutoff: HhMm;
  forecast: ErrorMetrics;
  baselines: {
    persistence: ErrorMetrics;
    sameHourD2: ErrorMetrics;
  };
  skill: {
    vsPersistence_pct: number;
    vsSameHourD2_pct: number;
  };
  byHorizon: HorizonBucket[];
  byHourOfDay: HourOfDayStat[];
  byDay: DayStat[];
  histogram: HistogramBin[];
  series: SeriesPoint[];
  band: BandCoverage;
}

/**
 * Backtest of the decision-time P10–P90 band: share of hours where the actual fell inside / below
 * P10 / above P90. Hours without a band are excluded; percentages are null when `n` is 0.
 */
export interface BandCoverage {
  n: number;
  coverage_pct: number | null;
  belowP10_pct: number | null;
  aboveP90_pct: number | null;
  nominal_pct: number;
}

export interface LeadTimePoint {
  leadHours: number;
  leadFrom: number;
  leadTo: number;
  n: number;
  mae: number;
  rmse: number;
  bias: number;
}

export interface LeadTime {
  start: IsoDate;
  end: IsoDate;
  points: LeadTimePoint[];
}
