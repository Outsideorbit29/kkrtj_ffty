import { useMemo } from 'react';
import type { Accuracy, ForecastLevelBucket, HhMm, IsoDate, LeadTime } from '../api/types';
import { Card } from '../components/Card';
import { DailyErrorChart } from '../components/charts/DailyErrorChart';
import { ErrorHistogram } from '../components/charts/ErrorHistogram';
import { ForecastLevelChart } from '../components/charts/ForecastLevelChart';
import { HourOfDayChart } from '../components/charts/HourOfDayChart';
import { LeadTimeChart } from '../components/charts/LeadTimeChart';
import { StatCard } from '../components/StatCard';
import { DashSkeleton, ErrorState, LoadingStatus, Skeleton } from '../components/States';
import { DayTable, ForecastLevelTable, HistogramTable, HourTable, LeadTimeTable, MetricsTable } from '../components/tables';
import { adjustedTag, bandTag, biasTag, skillTag } from '../components/tags';
import { useAccuracy, useLeadTime } from '../hooks/api';
import type { Resource } from '../hooks/useApiResource';
import { forecastLevelTrend, leadTimeSummary } from '../lib/chartData';
import { formatPct, formatPower } from '../lib/format';

function AccuracyKpis({ a }: { a: Accuracy }) {
  const f = a.forecast;
  const { band, forecastAdjusted: adj } = a;
  return (
    <div className="kpis kpis--dense">
      <StatCard
        accent
        label="Mean absolute error"
        value={formatPower(f.mae)}
        spark={{ values: a.byDay.map((d) => d.mae), kind: 'area', caption: 'Daily MAE' }}
        detail={`Typical hourly miss across ${f.n.toLocaleString('en-GB')} hours`}
      />
      <StatCard label="RMSE" value={formatPower(f.rmse)} detail="Weights big misses more; well above MAE means occasional large busts" />
      <StatCard
        label="P90 absolute error"
        value={formatPower(f.p90_abs_error)}
        detail={`9 hours in 10 miss by less than this · worst ${formatPower(f.max_abs_error)}`}
      />
      <StatCard
        label="Normalised MAE"
        value={formatPct(f.nmae_pct)}
        meter={{ value: f.nmae_pct, max: 50 }}
        detail={`MAE as a share of mean actual wind (${formatPower(f.mean_actual)})`}
      />
      <StatCard
        label="Bias"
        value={formatPower(f.bias, { signed: true })}
        tag={biasTag(f.bias)}
        spark={{ values: a.byDay.map((d) => d.bias), kind: 'diverging', caption: 'Daily bias' }}
        detail="Mean of forecast − actual"
      />
      <StatCard
        label="Skill vs persistence"
        value={formatPct(a.skill.vsPersistence_pct, { signed: true, digits: 0 })}
        tag={skillTag(a.skill.vsPersistence_pct)}
        detail={`vs holding the last known output flat (MAE ${formatPower(a.baselines.persistence.mae)})`}
      />
      <StatCard
        label="Skill vs same hour D-2"
        value={formatPct(a.skill.vsSameHourD2_pct, { signed: true, digits: 0 })}
        tag={skillTag(a.skill.vsSameHourD2_pct)}
        detail={`vs repeating the same hour two days earlier (MAE ${formatPower(a.baselines.sameHourD2.mae)})`}
      />
      <StatCard
        label="Bias-corrected MAE (P50)"
        value={formatPower(adj.mae)}
        tag={adjustedTag(a.skill.adjustedVsForecast_pct)}
        detail={
          adj.n > 0
            ? `Forecast minus its trailing 28-day median error · bias ${formatPower(adj.bias, { signed: true })}`
            : 'Unavailable: too little error history in this range'
        }
      />
      <StatCard
        label="P10–P90 band coverage"
        value={formatPct(band.coverage_pct, { digits: 0 })}
        tag={bandTag(band)}
        meter={band.coverage_pct == null ? undefined : { value: band.coverage_pct, max: 100, target: band.nominal_pct }}
        detail={`${band.n.toLocaleString('en-GB')} hours tested (target ${band.nominal_pct}%) · below P10 ${formatPct(band.belowP10_pct)}, above P90 ${formatPct(band.aboveP90_pct)}`}
      />
    </div>
  );
}

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
    `The bias is ≈ ${signed(win.bias)} in your window and still ${signed(first.bias)} at ${first.leadFrom}–${first.leadTo} h, ` +
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
    `where ${formatPct(high.overForecastShare * 100, { digits: 0 })} of hours came in below forecast. ${curtailment}`
  );
}

/** Explains a large systematic bias; shown only when |bias| exceeds 5% of mean actual wind. */
function BiasFinding({ a, leadTime }: { a: Accuracy; leadTime: LeadTime | undefined }) {
  const { bias, mean_actual: meanActual } = a.forecast;
  if (!(meanActual > 0) || Math.abs(bias) <= 0.05 * meanActual) return null;
  const high = bias > 0;
  const first = leadTime?.points.find((p) => p.n > 0);

  return (
    <div className={`alert alert--${high ? 'over' : 'under'} span-12`} role="note">
      <p className="alert__title">Why the forecast runs {high ? 'high' : 'low'}</p>
      <ul className="alert__list">
        <li>
          <strong>What to do:</strong> plan on the expected (P50) line and the P10–P90 band on the Decision page, not the raw
          forecast. Both are built from the last 28 days of decision-time errors, so they already remove this offset.
        </li>
        <li>
          The mean error is <strong>{signed(bias)}</strong> ({formatPct((Math.abs(bias) / meanActual) * 100, { digits: 0 })} of mean
          wind)
          {first && (
            <>
              , and it barely changes with lead time: still <strong>{signed(first.bias)}</strong> at {first.leadFrom}–{first.leadTo} h
              ahead
            </>
          )}
          . Deciding later does not remove it.
        </li>
        {high && (
          <li>
            Most likely structural: WINDFOR forecasts what wind farms could produce, while FUELHH WIND is metered output after
            transmission-constraint curtailment (mostly in Scotland on windy days). Forecasts and actuals are matched on UTC start
            time and the hourly actual is the mean of both half-hours, so this is not an alignment or units error.
          </li>
        )}
      </ul>
    </div>
  );
}

function AccuracyContent({ a, leadTime, stale }: { a: Accuracy; leadTime: Resource<LeadTime>; stale: boolean }) {
  const horizon = useMemo(() => decisionHorizon(a), [a]);

  return (
    <div className={`dash${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <AccuracyKpis a={a} />
      <div className="grid">
        <BiasFinding a={a} leadTime={leadTime.data} />
        <Card
          span="span-6"
          title="Error by lead time"
          subtitle="MAE and bias of every forecast run by hours ahead · GW"
          caption={leadTimeCaption(a, leadTime.data, horizon)}
          table={leadTime.data && <LeadTimeTable points={leadTime.data.points} />}
        >
          {leadTime.error ? (
            <ErrorState error={leadTime.error} onRetry={leadTime.retry} />
          ) : leadTime.data ? (
            <div className={leadTime.loading ? 'is-stale' : undefined}>
              <LeadTimeChart points={leadTime.data.points} decisionHorizon={horizon} />
            </div>
          ) : (
            <div className="chart chart--sm">
              <Skeleton height="100%" />
            </div>
          )}
        </Card>
        <Card
          span="span-6"
          title="Bias by forecast level"
          subtitle="Mean forecast − actual by the decision-time forecast, 4 GW buckets · GW"
          caption={forecastLevelCaption(a.byForecastLevel)}
          table={<ForecastLevelTable rows={a.byForecastLevel} />}
        >
          <ForecastLevelChart buckets={a.byForecastLevel} />
        </Card>
        <Card
          span="span-6"
          title="Error distribution"
          subtitle="Hours by size of forecast error, 500 MW bins"
          caption="The red tail is your shortfall exposure: how often, and by how much, wind came in below the forecast you bought against."
          table={<HistogramTable bins={a.histogram} />}
        >
          <ErrorHistogram bins={a.histogram} />
        </Card>
        <Card
          span="span-6"
          title="MAE by hour of day"
          subtitle="Decision-time forecast · GW, UK hours"
          caption="Hours with bigger typical misses need more flexible cover than the forecast alone suggests."
          table={<HourTable rows={a.byHourOfDay} />}
        >
          <HourOfDayChart hours={a.byHourOfDay} />
        </Card>
        <Card
          span="span-12"
          title="Daily error"
          subtitle="Per delivery day · GW"
          caption="Red days were over-forecast: wind fell short and the gap was bought back."
          table={<DayTable rows={a.byDay} />}
        >
          <DailyErrorChart days={a.byDay} />
        </Card>
        <Card span="span-12" title="All metrics by model" subtitle="Published forecast, bias-corrected P50 and the two naive baselines">
          <MetricsTable a={a} />
        </Card>
      </div>
    </div>
  );
}

export function AccuracyPage({ start, end, cutoff }: { start: IsoDate; end: IsoDate; cutoff: HhMm }) {
  const accuracy = useAccuracy(start, end, cutoff);
  const leadTime = useLeadTime(start, end);
  const { data, error, loading, retry } = accuracy;

  if (error) return <ErrorState error={error} onRetry={retry} />;
  return (
    <>
      {loading && <LoadingStatus label="Loading accuracy statistics" />}
      {data ? <AccuracyContent a={data} leadTime={leadTime} stale={loading} /> : <DashSkeleton kpis={9} panels={[6, 6, 6, 6]} />}
    </>
  );
}
