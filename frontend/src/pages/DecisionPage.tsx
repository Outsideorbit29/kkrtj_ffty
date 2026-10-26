import type { Decision, HhMm, Meta } from '../api/types';
import { ChartCard } from '../components/ChartCard';
import { DecisionChart } from '../components/charts/DecisionChart';
import { RunsChart } from '../components/charts/RunsChart';
import { HOUR_MS } from '../components/charts/common';
import { DateStepper } from '../components/DateStepper';
import { HourlyTable } from '../components/HourlyTable';
import { Clock } from '../components/Icons';
import { KpiTile, type TagTone } from '../components/KpiTile';
import { CardSkeleton, ErrorState, KpiSkeleton, LoadingStatus } from '../components/States';
import { useDecision } from '../hooks/api';
import { useUrlState } from '../hooks/useUrlState';
import { bandBacktest, expectedEnergy } from '../lib/chartData';
import { addDays, clampDate, formatCalendarDate, formatCalendarDateLong, isIsoDate } from '../lib/dates';
import { formatDay, formatDuration, formatEnergy, formatPower, formatTime, toMs } from '../lib/format';

const hourSpan = (iso: string) => `${formatTime(iso)}–${formatTime(toMs(iso) + HOUR_MS)}`;

function DecisionCallout({ d }: { d: Decision }) {
  const publishDay = formatDay(d.forecastPublishTimeUtc);
  const sameDay = publishDay === formatDay(d.decisionTimeUtc);
  const run = `${formatTime(d.forecastPublishTimeUtc)}${sameDay ? '' : ` ${publishDay}`}`;
  const laterRuns = d.runs.filter((r) => !r.availableAtDecision).length;

  return (
    <div className="callout">
      <Clock className="callout__icon" />
      <div>
        <p className="callout__text">
          Decision at <strong>{d.cutoff}</strong> on <strong>{formatCalendarDate(d.decisionDate)}</strong> uses the{' '}
          <strong>{run}</strong> forecast run ({formatDuration(d.forecastAgeMinutes)} old).
        </p>
        <p className="callout__meta">
          Delivery {formatCalendarDateLong(d.deliveryDate)}
          {laterRuns > 0 && ` · ${laterRuns} later run${laterRuns === 1 ? '' : 's'} arrived too late to use`}
          {` · Band: ${d.bandMethod}`}
        </p>
      </div>
    </div>
  );
}

function errorTag(errorMWh: number | null): { text: string; tone: TagTone } | undefined {
  if (errorMWh == null) return undefined;
  if (errorMWh > 0) return { text: `Over-forecast by ${formatEnergy(errorMWh)}`, tone: 'bad' };
  if (errorMWh < 0) return { text: `Under-forecast by ${formatEnergy(-errorMWh)}`, tone: 'neutral' };
  return { text: 'Spot on', tone: 'good' };
}

function DecisionKpis({ d }: { d: Decision }) {
  const { summary, hourly } = d;
  // Energy totals cover only the hours the decision run reaches (all 24 for most cutoffs).
  const covered = hourly.filter((r) => r.forecast !== null).length;
  const coverage = covered < hourly.length ? ` of ${hourly.length}; the decision run ends before midnight` : '';
  // P50/P10 totals and their comparison with the forecast use the hours that have a band.
  const expected = expectedEnergy(hourly);
  const p50MWh = summary.p50MWh ?? expected.p50MWh;
  const offsetMWh = expected.forecastMWh !== null && expected.p50MWh !== null ? expected.forecastMWh - expected.p50MWh : null;
  const beyondP50MWh = expected.p50MWh !== null && expected.p10MWh !== null ? expected.p50MWh - expected.p10MWh : null;
  const backtest = bandBacktest(hourly);

  return (
    <div className="kpi-grid">
      <KpiTile
        label="Expected wind energy (P50)"
        value={formatEnergy(p50MWh)}
        detail={
          p50MWh == null
            ? 'Needs error history from earlier days'
            : `Bias-corrected plan: average ${formatPower(expected.hours ? (expected.p50MWh ?? 0) / expected.hours : null)} over ${expected.hours} hours`
        }
        emphasis
      />
      <KpiTile
        label="Published forecast"
        value={formatEnergy(summary.forecastMWh)}
        detail={
          offsetMWh == null
            ? `Elexon WINDFOR over ${covered} hours${coverage}`
            : `${formatEnergy(offsetMWh, { signed: true })} vs P50 (median error of the last 28 days) · ${covered} hours${coverage}`
        }
      />
      <KpiTile
        label="Extra cover for low wind (P10)"
        value={formatEnergy(beyondP50MWh ?? summary.shortfallP90MWh)}
        detail={
          beyondP50MWh == null
            ? `Forecast − P10. Day total if every hour lands at its P10: ${formatEnergy(expected.p10MWh)}.`
            : `Below the P50 plan (${formatEnergy(summary.shortfallP90MWh)} below the published forecast). Day total if every hour lands at its P10: ${formatEnergy(expected.p10MWh)}; each hour has a 1-in-10 chance of coming in lower.`
        }
      />
      <KpiTile
        label="Forecast low / peak"
        value={`${formatPower(summary.minForecast.mw)} / ${formatPower(summary.maxForecast.mw)}`}
        detail={`Lowest ${hourSpan(summary.minForecast.startTime)} · peak ${hourSpan(summary.maxForecast.startTime)}`}
      />
      <KpiTile
        label="Actual (backtest)"
        value={formatEnergy(summary.actualMWh)}
        tag={errorTag(summary.errorMWh)}
        detail={summary.mae == null ? 'Actuals not available yet' : `Published forecast's hourly MAE ${formatPower(summary.mae)}`}
      />
      <KpiTile
        label="Hours inside the band"
        value={backtest.n === 0 ? '–' : `${backtest.inBand}/${backtest.n}`}
        detail={backtest.n === 0 ? 'Actuals not available yet' : 'Backtest: the 80% band should hold about 8 hours in 10'}
      />
    </div>
  );
}

/** Chart caption; the offset is the day's mean forecast − P50, i.e. the trailing median error. */
function decisionCaption(hourly: Decision['hourly']): string {
  const rows = hourly.filter((r) => r.p50 != null && r.forecast !== null);
  if (rows.length === 0) {
    return 'No bias-corrected line yet (too little error history). Size your cover for the bottom of the band: the low-wind outcome about one hour in ten.';
  }
  const offset = rows.reduce((sum, r) => sum + (r.forecast ?? 0) - (r.p50 ?? 0), 0) / rows.length;
  const direction = offset >= 0 ? 'high' : 'low';
  return `Plan on the expected (P50) line: over the last 28 days the published forecast has run about ${formatPower(Math.abs(offset))} ${direction}. Size cover down to the bottom of the band (P10), the low-wind outcome about one hour in ten.`;
}

function DecisionContent({ d, stale }: { d: Decision; stale: boolean }) {
  return (
    <div className={`stack${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <DecisionCallout d={d} />
      <DecisionKpis d={d} />
      <ChartCard
        title={`Wind forecast for ${formatCalendarDate(d.deliveryDate)}`}
        subtitle="GB national wind, GW, hourly averages, UK time"
        caption={decisionCaption(d.hourly)}
      >
        <DecisionChart hourly={d.hourly} actualHalfHourly={d.actualHalfHourly} />
      </ChartCard>
      <ChartCard
        title="How the forecast evolved"
        subtitle="Every forecast run covering this day, from two days ahead to delivery"
        caption={`Dashed runs arrived after the ${d.cutoff} cutoff. A big move between the decision run and those later runs is the risk you carry by committing at ${d.cutoff}.`}
      >
        <RunsChart runs={d.runs} hourly={d.hourly} />
      </ChartCard>
      <HourlyTable decision={d} />
    </div>
  );
}

export function DecisionPage({ meta, cutoff }: { meta: Meta; cutoff: HhMm }) {
  const [rawDate, setDecisionDate] = useUrlState('decision', meta.decisionStart);
  const decisionDate = isIsoDate(rawDate) ? clampDate(rawDate, meta.decisionStart, meta.decisionEnd) : meta.decisionStart;
  const deliveryDate = addDays(decisionDate, 1);
  const { data, error, loading, retry } = useDecision(deliveryDate, cutoff);

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">Day-ahead decision</h2>
        <p className="page-subtitle">What the desk saw at the cutoff, and what the wind then did.</p>
      </div>
      <div className="toolbar">
        <DateStepper
          label="Decision date"
          value={decisionDate}
          min={meta.decisionStart}
          max={meta.decisionEnd}
          onChange={setDecisionDate}
        />
        <p className="toolbar__hint">
          Buying for delivery on <strong>{formatCalendarDate(deliveryDate)}</strong>
        </p>
      </div>
      {loading && <LoadingStatus label="Loading forecast" />}
      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : data ? (
        <DecisionContent d={data} stale={loading} />
      ) : (
        <div className="stack">
          <CardSkeleton height={24} />
          <KpiSkeleton count={6} />
          <CardSkeleton height={320} />
          <CardSkeleton height={280} />
        </div>
      )}
    </>
  );
}
