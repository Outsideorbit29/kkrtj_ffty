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
  const p10s = hourly.map((r) => r.p10).filter((v): v is number => v !== null);
  const p10MWh = p10s.length ? p10s.reduce((sum, v) => sum + v, 0) : null;
  const avgMw = covered ? summary.forecastMWh / covered : 0;
  const coverage = covered < hourly.length ? ` of ${hourly.length}; the decision run ends before midnight` : '';

  return (
    <div className="kpi-grid">
      <KpiTile
        label="Forecast wind energy"
        value={formatEnergy(summary.forecastMWh)}
        detail={`Average ${formatPower(avgMw)} over ${covered} hours${coverage}`}
        emphasis
      />
      <KpiTile
        label="Low-wind case (P10)"
        value={formatEnergy(p10MWh)}
        detail="Sum of hourly P10s: each hour has a 1-in-10 chance of coming in lower"
      />
      <KpiTile
        label="Shortfall risk (P90)"
        value={formatEnergy(summary.shortfallP90MWh)}
        detail="Extra cover needed if every hour lands at its P10 (forecast − P10)"
      />
      <KpiTile label="Lowest hour" value={formatPower(summary.minForecast.mw)} detail={hourSpan(summary.minForecast.startTime)} />
      <KpiTile label="Peak hour" value={formatPower(summary.maxForecast.mw)} detail={hourSpan(summary.maxForecast.startTime)} />
      <KpiTile
        label="Actual (backtest)"
        value={formatEnergy(summary.actualMWh)}
        tag={errorTag(summary.errorMWh)}
        detail={summary.mae == null ? 'Actuals not available yet' : `Hourly MAE ${formatPower(summary.mae)}`}
      />
    </div>
  );
}

function DecisionContent({ d, stale }: { d: Decision; stale: boolean }) {
  return (
    <div className={`stack${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <DecisionCallout d={d} />
      <DecisionKpis d={d} />
      <ChartCard
        title={`Wind forecast for ${formatCalendarDate(d.deliveryDate)}`}
        subtitle="GB national wind, GW, hourly averages, UK time"
        caption="Buy against the blue line, but size your cover for the bottom of the band: that is the low-wind outcome you will face about one hour in ten."
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
