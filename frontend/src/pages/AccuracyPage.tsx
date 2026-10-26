import { useMemo } from 'react';
import type {
  Accuracy,
  BandCoverage,
  DayStat,
  ForecastLevelBucket,
  HhMm,
  HistogramBin,
  HourOfDayStat,
  LeadTime,
  LeadTimePoint,
  Meta,
} from '../api/types';
import { ChartCard } from '../components/ChartCard';
import { DailyErrorChart } from '../components/charts/DailyErrorChart';
import { ErrorHistogram } from '../components/charts/ErrorHistogram';
import { ForecastLevelChart } from '../components/charts/ForecastLevelChart';
import { ForecastActualChart } from '../components/charts/ForecastActualChart';
import { HourOfDayChart } from '../components/charts/HourOfDayChart';
import { LeadTimeChart } from '../components/charts/LeadTimeChart';
import { DataTable } from '../components/DataTable';
import { DateRangePicker } from '../components/DateRangePicker';
import { Info } from '../components/Icons';
import { KpiTile, type TagTone } from '../components/KpiTile';
import { CardSkeleton, ErrorState, KpiSkeleton, LoadingStatus, Skeleton } from '../components/States';
import { useAccuracy, useLeadTime } from '../hooks/api';
import type { Resource } from '../hooks/useApiResource';
import { useUrlState } from '../hooks/useUrlState';
import { errorSpread, forecastLevelTrend, leadTimeSummary } from '../lib/chartData';
import { clampDate, formatCalendarDate, isIsoDate } from '../lib/dates';
import { formatBin, formatEnergy, formatMw, formatPct, formatPower, hourLabel } from '../lib/format';

function skillTag(pct: number): { text: string; tone: TagTone } {
  return pct > 0 ? { text: 'Beats the baseline', tone: 'good' } : { text: 'Worse than baseline', tone: 'bad' };
}

function biasTag(bias: number): { text: string; tone: TagTone } {
  if (bias > 0) return { text: 'Over-forecast · shortfall risk', tone: 'bad' };
  if (bias < 0) return { text: 'Under-forecast · surplus risk', tone: 'neutral' };
  return { text: 'Unbiased', tone: 'good' };
}

function bandTag(band: BandCoverage): { text: string; tone: TagTone } | undefined {
  if (band.coverage_pct == null) return undefined;
  const gap = band.coverage_pct - band.nominal_pct;
  if (gap < -5) return { text: 'Too narrow', tone: 'bad' };
  return gap > 5 ? { text: 'Conservative', tone: 'good' } : { text: 'Calibrated', tone: 'good' };
}

/** % MAE improvement of the bias-corrected P50 over the raw forecast. */
function adjustedTag(gainPct: number | null): { text: string; tone: TagTone } | undefined {
  if (gainPct == null) return undefined;
  const size = formatPct(Math.abs(gainPct), { digits: 0 });
  return gainPct > 0 ? { text: `${size} lower than raw`, tone: 'good' } : { text: `${size} higher than raw`, tone: 'bad' };
}

function AccuracyKpis({ a }: { a: Accuracy }) {
  const f = a.forecast;
  const { band, forecastAdjusted: adj } = a;
  return (
    <div className="kpi-grid">
      <KpiTile
        label="Mean absolute error"
        value={formatPower(f.mae)}
        detail={`Typical hourly miss across ${f.n.toLocaleString('en-GB')} hours`}
        emphasis
      />
      <KpiTile label="RMSE" value={formatPower(f.rmse)} detail="Weights big misses more; well above MAE means occasional large busts" />
      <KpiTile
        label="Bias"
        value={formatPower(f.bias, { signed: true })}
        tag={biasTag(f.bias)}
        detail="Mean of forecast − actual. Positive: wind over-forecast, so you end up short"
      />
      <KpiTile
        label="P90 absolute error"
        value={formatPower(f.p90_abs_error)}
        detail={`9 hours in 10 miss by less than this · worst ${formatPower(f.max_abs_error)}`}
      />
      <KpiTile
        label="Normalised MAE"
        value={formatPct(f.nmae_pct)}
        detail={`MAE as a share of mean actual wind (${formatPower(f.mean_actual)})`}
      />
      <KpiTile
        label="Skill vs persistence"
        value={formatPct(a.skill.vsPersistence_pct, { signed: true, digits: 0 })}
        tag={skillTag(a.skill.vsPersistence_pct)}
        detail={`MAE reduction vs holding the last known output flat (${formatPower(a.baselines.persistence.mae)})`}
      />
      <KpiTile
        label="Skill vs D-2"
        value={formatPct(a.skill.vsSameHourD2_pct, { signed: true, digits: 0 })}
        tag={skillTag(a.skill.vsSameHourD2_pct)}
        detail={`MAE reduction vs repeating the same hour two days earlier (${formatPower(a.baselines.sameHourD2.mae)})`}
      />
      <KpiTile
        label="Bias-corrected MAE (P50)"
        value={formatPower(adj.mae)}
        tag={adjustedTag(a.skill.adjustedVsForecast_pct)}
        detail={
          adj.n > 0
            ? `Forecast minus its trailing 28-day median error, vs ${formatPower(f.mae)} raw · bias ${formatPower(adj.bias, { signed: true })}`
            : 'Unavailable: too little error history in this range'
        }
      />
      <KpiTile
        label="P10–P90 band coverage"
        value={formatPct(band.coverage_pct, { digits: 0 })}
        tag={bandTag(band)}
        detail={`Actual inside the band in ${band.n.toLocaleString('en-GB')} hours tested (nominal ${band.nominal_pct}%) · below P10 ${formatPct(band.belowP10_pct)}, above P90 ${formatPct(band.aboveP90_pct)}`}
      />
    </div>
  );
}

const leadTimeTable = (points: LeadTimePoint[]) => (
  <DataTable
    caption="Forecast error by lead time, all runs"
    rows={points}
    rowKey={(p) => String(p.leadFrom)}
    columns={[
      { header: 'Lead time', cell: (p) => `${p.leadFrom}–${p.leadTo} h` },
      { header: 'Hours', cell: (p) => p.n.toLocaleString('en-GB') },
      { header: 'MAE MW', cell: (p) => formatMw(p.mae) },
      { header: 'RMSE MW', cell: (p) => formatMw(p.rmse) },
      { header: 'Bias MW', cell: (p) => formatMw(p.bias, { signed: true }) },
      { header: 'Spread excl. bias MW', cell: (p) => formatMw(errorSpread(p)) },
    ]}
  />
);

const hourTable = (rows: HourOfDayStat[]) => (
  <DataTable
    caption="Forecast error by hour of day"
    rows={rows}
    rowKey={(r) => String(r.hour)}
    columns={[
      { header: 'Hour (UK)', cell: (r) => hourLabel(r.hour) },
      { header: 'Hours', cell: (r) => r.n },
      { header: 'MAE MW', cell: (r) => formatMw(r.mae) },
      { header: 'Bias MW', cell: (r) => formatMw(r.bias, { signed: true }) },
    ]}
  />
);

const dayTable = (rows: DayStat[]) => (
  <DataTable
    caption="Forecast error by delivery day"
    rows={rows}
    rowKey={(r) => r.date}
    columns={[
      { header: 'Delivery day', cell: (r) => formatCalendarDate(r.date) },
      { header: 'MAE MW', cell: (r) => formatMw(r.mae) },
      { header: 'Bias MW', cell: (r) => formatMw(r.bias, { signed: true }), className: (r) => (r.bias > 0 ? 'pos' : undefined) },
      { header: 'Forecast', cell: (r) => formatEnergy(r.forecastMWh) },
      { header: 'Actual', cell: (r) => formatEnergy(r.actualMWh) },
    ]}
  />
);

const forecastLevelTable = (rows: ForecastLevelBucket[]) => (
  <DataTable
    caption="Forecast error by decision-time forecast level"
    rows={rows}
    rowKey={(r) => String(r.from)}
    columns={[
      { header: 'Forecast level', cell: (r) => r.bucket },
      { header: 'Hours', cell: (r) => r.n.toLocaleString('en-GB') },
      { header: 'MAE MW', cell: (r) => formatMw(r.mae) },
      { header: 'Bias MW', cell: (r) => formatMw(r.bias, { signed: true }), className: (r) => (r.bias > 0 ? 'pos' : undefined) },
      { header: 'Hours over-forecast', cell: (r) => formatPct(r.overForecastShare * 100, { digits: 0 }) },
    ]}
  />
);

const histogramTable = (bins: HistogramBin[]) => (
  <DataTable
    caption="Distribution of hourly forecast errors"
    rows={bins}
    rowKey={(b) => String(b.from)}
    columns={[
      { header: 'Error (forecast − actual)', cell: formatBin },
      { header: 'Hours', cell: (b) => b.count },
    ]}
  />
);

/** Range of lead times the decision-time forecast covered, for the marker on the lead-time chart. */
function decisionHorizon(a: Accuracy): { from: number; to: number } | undefined {
  if (a.series.length === 0) return undefined;
  const horizons = a.series.map((p) => p.horizonHours);
  return { from: Math.min(...horizons), to: Math.max(...horizons) };
}

const signed = (mw: number) => formatPower(mw, { signed: true });

/** Lead-time caption built from the data: how much deciding later helps, against the bias. */
function leadTimeCaption(a: Accuracy, leadTime: LeadTime | undefined, horizon: { from: number; to: number } | undefined): string {
  const horizonText = horizon ? `${Math.round(horizon.from)}–${Math.round(horizon.to)} h` : 'the shaded range';
  const summary = leadTime && leadTimeSummary(leadTime.points, horizon);
  if (!summary?.window) {
    return `MAE grows with lead time; the bias does not. Your ${a.cutoff} decision relies on forecasts ${horizonText} ahead.`;
  }
  const { first, window: win } = summary;
  return (
    `Your ${a.cutoff} decision relies on forecasts ${horizonText} ahead (MAE ≈ ${formatPower(win.mae)}). ` +
    `Waiting until delivery only trims this to ≈ ${formatPower(first.mae)} at ${first.leadFrom}–${first.leadTo} h. ` +
    `MAE grows with lead time but the bias does not: it is ≈ ${signed(win.bias)} in your window and still ${signed(first.bias)} at ${first.leadFrom}–${first.leadTo} h, ` +
    'so correcting for bias is a bigger lever than deciding later.'
  );
}

/** Forecast-level caption: does the over-forecast grow with wind level, and what that suggests. */
function forecastLevelCaption(buckets: ForecastLevelBucket[]): string {
  const trend = forecastLevelTrend(buckets);
  const curtailment =
    'That pattern is consistent with curtailment: on windy days transmission constraints cap metered output, while the forecast is not capped.';
  if (!trend) return `Bias by the forecast you saw at decision time. ${curtailment}`;
  const { low, high, rising } = trend;
  if (!rising) {
    return `In this range the bias does not grow with wind level (${signed(low.bias)} at ${low.bucket}, ${signed(high.bias)} at ${high.bucket}), so a flat correction is a fair approximation.`;
  }
  return (
    `The over-forecast grows with wind level: ${signed(low.bias)} when ${low.bucket} is forecast, ${signed(high.bias)} at ${high.bucket}, ` +
    `where ${formatPct(high.overForecastShare * 100, { digits: 0 })} of hours came in below forecast. ${curtailment} ` +
    'On high-wind days, expect a bigger shortfall than a flat correction implies.'
  );
}

/** Explains a large systematic bias; shown only when |bias| exceeds 5% of mean actual wind. */
function BiasFinding({ a, leadTime }: { a: Accuracy; leadTime: LeadTime | undefined }) {
  const { bias, mean_actual: meanActual } = a.forecast;
  if (!(meanActual > 0) || Math.abs(bias) <= 0.05 * meanActual) return null;
  const high = bias > 0;
  const first = leadTime?.points.find((p) => p.n > 0);

  return (
    <div className="callout callout--finding" role="note">
      <Info className="callout__icon" />
      <div>
        <p className="callout__title">Why the forecast runs {high ? 'high' : 'low'}</p>
        <ul className="callout__list">
          <li>
            The mean error is <strong>{signed(bias)}</strong> ({formatPct((Math.abs(bias) / meanActual) * 100, { digits: 0 })} of mean
            wind)
            {first && (
              <>
                , and it barely changes with lead time: still <strong>{signed(first.bias)}</strong> at {first.leadFrom}–
                {first.leadTo} h ahead
              </>
            )}
            . Deciding later does not remove it.
          </li>
          {high && (
            <li>
              It is most likely structural rather than a weather miss. WINDFOR forecasts what wind farms could produce, while FUELHH
              WIND is metered output after transmission-constraint curtailment (bid-offer acceptances, mostly in Scotland on windy
              days). The two streams may also cover slightly different sets of farms. The data alone cannot prove the cause.
            </li>
          )}
          <li>
            Alignment was checked: forecasts and actuals are matched on UTC start time, and the hourly actual is the mean of both
            half-hours, so this is not a units or aggregation error.
          </li>
          <li>
            What to do: plan on the expected (P50) line and the P10–P90 band on the Decision page, not the raw forecast. Both are
            built from the last 28 days of decision-time errors, so they already remove this offset.
          </li>
        </ul>
      </div>
    </div>
  );
}

function AccuracyContent({ a, leadTime, stale }: { a: Accuracy; leadTime: Resource<LeadTime>; stale: boolean }) {
  const horizon = useMemo(() => decisionHorizon(a), [a]);

  return (
    <div className={`stack${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <AccuracyKpis a={a} />
      <BiasFinding a={a} leadTime={leadTime.data} />
      <ChartCard
        title="Forecast vs actual"
        subtitle={`Forecast available at ${a.cutoff} the day before, against outturn · GW, hourly`}
        caption="Where orange dips below blue, wind under-delivered and the gap had to be bought back intraday or settled at imbalance prices."
      >
        <ForecastActualChart series={a.series} />
      </ChartCard>
      <div className="grid-2">
        <ChartCard
          title="Error by lead time"
          subtitle="MAE and bias of every forecast run by hours ahead · GW"
          caption={leadTimeCaption(a, leadTime.data, horizon)}
          table={leadTime.data && leadTimeTable(leadTime.data.points)}
        >
          {leadTime.error ? (
            <ErrorState error={leadTime.error} onRetry={leadTime.retry} />
          ) : leadTime.data ? (
            <div className={leadTime.loading ? 'is-stale' : undefined}>
              <LeadTimeChart points={leadTime.data.points} decisionHorizon={horizon} />
            </div>
          ) : (
            <Skeleton height={240} />
          )}
        </ChartCard>
        <ChartCard
          title="Bias by forecast level"
          subtitle="Mean forecast − actual by the decision-time forecast, 4 GW buckets · GW"
          caption={forecastLevelCaption(a.byForecastLevel)}
          table={forecastLevelTable(a.byForecastLevel)}
        >
          <ForecastLevelChart buckets={a.byForecastLevel} />
        </ChartCard>
      </div>
      <div className="grid-2">
        <ChartCard
          title="Daily error"
          subtitle="Per delivery day · GW"
          caption="Red days were over-forecast: wind fell short and the gap was bought back. Runs of red point to a systematic bias rather than noise."
          table={dayTable(a.byDay)}
        >
          <DailyErrorChart days={a.byDay} />
        </ChartCard>
        <ChartCard
          title="Error distribution"
          subtitle="Hours by size of forecast error, 500 MW bins"
          caption="The red tail is your shortfall exposure: how often, and by how much, wind came in below the forecast you bought against."
          table={histogramTable(a.histogram)}
        >
          <ErrorHistogram bins={a.histogram} />
        </ChartCard>
      </div>
      <ChartCard
        title="MAE by hour of day"
        subtitle="Decision-time forecast · GW, UK hours"
        caption="Hours with bigger typical misses need more flexible cover than the forecast alone suggests."
        table={hourTable(a.byHourOfDay)}
      >
        <HourOfDayChart hours={a.byHourOfDay} />
      </ChartCard>
    </div>
  );
}

export function AccuracyPage({ meta, cutoff }: { meta: Meta; cutoff: HhMm }) {
  const [rawStart, setStart] = useUrlState('from', meta.deliveryStart);
  const [rawEnd, setEnd] = useUrlState('to', meta.deliveryEnd);
  const clamp = (d: string, fallback: string) => (isIsoDate(d) ? clampDate(d, meta.deliveryStart, meta.deliveryEnd) : fallback);
  const start = clamp(rawStart, meta.deliveryStart);
  const end = clamp(rawEnd, meta.deliveryEnd) < start ? start : clamp(rawEnd, meta.deliveryEnd);

  const accuracy = useAccuracy(start, end, cutoff);
  const leadTime = useLeadTime(start, end);
  const { data, error, loading, retry } = accuracy;

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">Forecast accuracy</h2>
        <p className="page-subtitle">How far the forecast you buy against has been from what the wind actually did.</p>
      </div>
      <div className="toolbar">
        <DateRangePicker
          start={start}
          end={end}
          min={meta.deliveryStart}
          max={meta.deliveryEnd}
          onChange={(s, e) => {
            setStart(s);
            setEnd(e);
          }}
        />
        <p className="toolbar__hint">
          Decision cutoff <strong>{cutoff}</strong> on the day before delivery (change it at the top)
        </p>
      </div>
      {loading && <LoadingStatus label="Loading accuracy statistics" />}
      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : data ? (
        <AccuracyContent a={data} leadTime={leadTime} stale={loading} />
      ) : (
        <div className="stack">
          <KpiSkeleton count={9} />
          <CardSkeleton height={300} />
          <div className="grid-2">
            <CardSkeleton height={260} />
            <CardSkeleton height={260} />
          </div>
        </div>
      )}
    </>
  );
}
