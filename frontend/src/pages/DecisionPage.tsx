import type { Decision, HhMm, IsoDate, Meta } from '../api/types';
import { Card } from '../components/Card';
import { DecisionChart } from '../components/charts/DecisionChart';
import { HourlyErrorChart } from '../components/charts/HourlyErrorChart';
import { RunsChart } from '../components/charts/RunsChart';
import { HOUR_MS } from '../components/charts/common';
import { HourlyTable } from '../components/HourlyTable';
import { StatCard } from '../components/StatCard';
import { DashSkeleton, ErrorState, LoadingStatus, Skeleton } from '../components/States';
import { energyErrorTag } from '../components/tags';
import { DayStrip, FactList } from '../components/Widgets';
import { useAccuracy, useDecision } from '../hooks/api';
import { bandBacktest, expectedEnergy } from '../lib/chartData';
import { formatCalendarDate } from '../lib/dates';
import { formatDayTime, formatDuration, formatEnergy, formatPower, formatTime, toMs } from '../lib/format';

const hourSpan = (iso: string) => `${formatTime(iso)}–${formatTime(toMs(iso) + HOUR_MS)}`;

function DecisionKpis({ d }: { d: Decision }) {
  const { summary, hourly } = d;
  const expected = expectedEnergy(hourly);
  const p50MWh = summary.p50MWh ?? expected.p50MWh;
  const coverMWh = expected.p50MWh !== null && expected.p10MWh !== null ? expected.p50MWh - expected.p10MWh : summary.shortfallP90MWh;
  const offsetMWh = expected.forecastMWh !== null && expected.p50MWh !== null ? expected.forecastMWh - expected.p50MWh : null;
  const backtest = bandBacktest(hourly);
  const covered = hourly.filter((r) => r.forecast !== null).length;

  return (
    <div className="kpis kpis--quad">
      <StatCard
        accent
        label="Expected wind energy (P50)"
        value={formatEnergy(p50MWh)}
        spark={{ values: hourly.map((r) => r.p50 ?? r.forecast ?? 0), kind: 'area', caption: 'Hourly P50' }}
        detail={p50MWh == null ? 'Needs error history from earlier days' : `Bias-corrected plan over ${expected.hours} hours`}
      />
      <StatCard
        label="Published forecast"
        value={formatEnergy(summary.forecastMWh)}
        detail={offsetMWh == null ? `Elexon WINDFOR · ${covered} hours` : `${formatEnergy(offsetMWh, { signed: true })} above the P50 plan · ${covered} h`}
      />
      <StatCard
        label="Extra cover for low wind (P10)"
        value={formatEnergy(coverMWh)}
        detail={`If every hour lands at its P10: ${formatEnergy(expected.p10MWh)} for the day`}
      />
      <StatCard
        label="Forecast low / peak"
        value={`${formatPower(summary.minForecast.mw)} / ${formatPower(summary.maxForecast.mw)}`}
        detail={`Low ${hourSpan(summary.minForecast.startTime)} · peak ${hourSpan(summary.maxForecast.startTime)}`}
      />
      <StatCard
        label="Actual energy (backtest)"
        value={formatEnergy(summary.actualMWh)}
        tag={energyErrorTag(summary.errorMWh)}
        detail={summary.actualMWh == null ? 'Actuals not available yet' : 'Metered FUELHH wind for the day'}
      />
      <StatCard
        label="Day MAE / bias"
        value={formatPower(summary.mae)}
        detail={summary.bias == null ? 'Actuals not available yet' : `Bias ${formatPower(summary.bias, { signed: true })} for the published forecast`}
      />
      <StatCard
        label="Hours inside the band"
        value={backtest.n === 0 ? '–' : `${backtest.inBand}/${backtest.n}`}
        meter={backtest.n === 0 ? undefined : { value: backtest.inBand, max: backtest.n, target: backtest.n * 0.8 }}
        detail="An 80% band should hold about 8 hours in 10"
      />
      <StatCard
        label="Forecast run age"
        value={formatDuration(d.forecastAgeMinutes)}
        detail={`Run published ${formatDayTime(d.forecastPublishTimeUtc)}`}
      />
    </div>
  );
}

function DecisionTicket({ d }: { d: Decision }) {
  const later = d.runs.filter((r) => !r.availableAtDecision);
  const covered = d.hourly.filter((r) => r.forecast !== null).length;
  return (
    <FactList
      facts={[
        { label: 'Delivery day', value: formatCalendarDate(d.deliveryDate) },
        { label: 'Decision', value: `${d.cutoff} on ${formatCalendarDate(d.decisionDate)}`, note: 'UK time' },
        { label: 'Forecast run used', value: formatDayTime(d.forecastPublishTimeUtc), note: `${formatDuration(d.forecastAgeMinutes)} old` },
        { label: 'Runs considered', value: d.runs.length, note: `${later.length} arrived after the cutoff` },
        { label: 'Hours covered', value: `${covered} / ${d.hourly.length}` },
        { label: 'Rule', value: 'Latest run published strictly before the cutoff' },
        { label: 'Band', value: d.bandMethod },
      ]}
    />
  );
}

function decisionCaption(hourly: Decision['hourly']): string {
  const rows = hourly.filter((r) => r.p50 != null && r.forecast !== null);
  if (rows.length === 0) {
    return 'No bias-corrected line yet (too little error history). Size cover for the bottom of the band.';
  }
  const offset = rows.reduce((sum, r) => sum + (r.forecast ?? 0) - (r.p50 ?? 0), 0) / rows.length;
  const direction = offset >= 0 ? 'high' : 'low';
  return `Plan on the P50 line: over the last 28 days the published forecast has run about ${formatPower(Math.abs(offset))} ${direction}. Size cover down to P10, the low-wind outcome about one hour in ten.`;
}

function DecisionContent({ d, stale }: { d: Decision; stale: boolean }) {
  return (
    <div className={`dash${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <DecisionKpis d={d} />
      <div className="grid">
        <Card
          span="span-8"
          title={`Wind forecast for ${formatCalendarDate(d.deliveryDate)}`}
          subtitle="GB national wind, GW, hourly averages, UK time"
          footnote={`Band: ${d.bandMethod}`}
          caption={decisionCaption(d.hourly)}
        >
          <DecisionChart hourly={d.hourly} actualHalfHourly={d.actualHalfHourly} />
        </Card>
        <Card span="span-4" title="Decision ticket" subtitle="What the desk had at the cutoff">
          <DecisionTicket d={d} />
        </Card>
        <Card
          span="span-8"
          title="How the forecast evolved"
          subtitle="Every forecast run covering this day, from two days ahead to delivery"
          caption={`Dashed runs arrived after the ${d.cutoff} cutoff. A big move between the decision run and later runs is the risk you carry by committing at ${d.cutoff}.`}
        >
          <RunsChart runs={d.runs} hourly={d.hourly} />
        </Card>
        <Card span="span-4" title="Hourly error" subtitle="Published forecast − actual, per hour">
          <HourlyErrorChart hourly={d.hourly} />
        </Card>
        <HourlyTable decision={d} />
      </div>
    </div>
  );
}

interface DecisionPageProps {
  meta: Meta;
  deliveryDate: IsoDate;
  cutoff: HhMm;
  onSelectDelivery: (date: IsoDate) => void;
}

export function DecisionPage({ meta, deliveryDate, cutoff, onSelectDelivery }: DecisionPageProps) {
  const { data, error, loading, retry } = useDecision(deliveryDate, cutoff);
  const month = useAccuracy(meta.deliveryStart, meta.deliveryEnd, cutoff);

  return (
    <>
      <section className="card span-12 daystrip-card" aria-label="Pick a delivery day">
        <div className="card__head">
          <div className="card__titles">
            <h3 className="card__title">Delivery days</h3>
            <p className="card__subtitle">Bar height is each day's bias: red over-forecast, blue under. Click a day to open it.</p>
          </div>
        </div>
        {month.data ? <DayStrip days={month.data.byDay} selected={deliveryDate} onSelect={onSelectDelivery} /> : <Skeleton height={64} />}
      </section>
      {loading && <LoadingStatus label="Loading forecast" />}
      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : data ? (
        <DecisionContent d={data} stale={loading} />
      ) : (
        <DashSkeleton kpis={8} panels={[8, 4, 8, 4]} />
      )}
    </>
  );
}
