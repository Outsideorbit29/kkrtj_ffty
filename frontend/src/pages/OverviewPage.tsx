import type { Accuracy, HhMm, IsoDate } from '../api/types';
import { Card } from '../components/Card';
import { CumulativeEnergyChart } from '../components/charts/CumulativeEnergyChart';
import { DailyErrorChart } from '../components/charts/DailyErrorChart';
import { ErrorHeatmap } from '../components/charts/ErrorHeatmap';
import { ForecastActualChart } from '../components/charts/ForecastActualChart';
import { ModelComparisonChart } from '../components/charts/ModelComparisonChart';
import { ScatterFit } from '../components/charts/ScatterFit';
import { StatCard } from '../components/StatCard';
import { DashSkeleton, ErrorState, LoadingStatus } from '../components/States';
import { DayTable } from '../components/tables';
import { adjustedTag, bandTag, biasTag, skillTag } from '../components/tags';
import { FactList, SplitBar, WorstDays } from '../components/Widgets';
import { useAccuracy } from '../hooks/api';
import { cumulativeEnergy, directionSplit, energyTotals, worstHour } from '../lib/dashboard';
import { formatDayTime, formatEnergy, formatPct, formatPower } from '../lib/format';

function OverviewKpis({ a }: { a: Accuracy }) {
  const f = a.forecast;
  const { band, forecastAdjusted: adj } = a;
  const energy = energyTotals(a.byDay);
  const gaps = cumulativeEnergy(a.byDay).map((p) => p.gapGWh);

  return (
    <div className="kpis">
      <StatCard
        accent
        label="Mean absolute error"
        value={formatPower(f.mae)}
        spark={{ values: a.byDay.map((d) => d.mae), kind: 'area', caption: 'Daily MAE' }}
        detail={`${formatPct(f.nmae_pct)} of mean wind · ${f.n.toLocaleString('en-GB')} hours`}
      />
      <StatCard
        label="Bias (forecast − actual)"
        value={formatPower(f.bias, { signed: true })}
        tag={biasTag(f.bias)}
        spark={{ values: a.byDay.map((d) => d.bias), kind: 'diverging', caption: 'Daily bias' }}
        detail="Positive: wind came in below forecast, so you end up short"
      />
      <StatCard
        label="Bias-corrected MAE (P50)"
        value={formatPower(adj.mae)}
        tag={adjustedTag(a.skill.adjustedVsForecast_pct)}
        detail={adj.n > 0 ? `vs ${formatPower(f.mae)} raw · bias ${formatPower(adj.bias, { signed: true })}` : 'Too little error history'}
      />
      <StatCard
        label="P10–P90 band coverage"
        value={formatPct(band.coverage_pct, { digits: 0 })}
        tag={bandTag(band)}
        meter={band.coverage_pct == null ? undefined : { value: band.coverage_pct, max: 100, target: band.nominal_pct }}
        detail={`Target ${band.nominal_pct}% · below P10 ${formatPct(band.belowP10_pct)} · above P90 ${formatPct(band.aboveP90_pct)}`}
      />
      <StatCard
        label="Skill vs persistence"
        value={formatPct(a.skill.vsPersistence_pct, { signed: true, digits: 0 })}
        tag={skillTag(a.skill.vsPersistence_pct)}
        detail={`Persistence MAE ${formatPower(a.baselines.persistence.mae)} · vs D-2 ${formatPct(a.skill.vsSameHourD2_pct, { signed: true, digits: 0 })}`}
      />
      <StatCard
        label="Energy shortfall"
        value={formatEnergy(energy.gapMWh, { signed: true })}
        tag={energy.gapMWh > 0 ? { text: 'Under-delivered', tone: 'bad' } : { text: 'Over-delivered', tone: 'neutral' }}
        spark={{ values: gaps, kind: 'area', color: 'var(--diverge-over)', caption: 'Cumulative gap' }}
        detail={`Forecast ${formatEnergy(energy.forecastMWh)} vs actual ${formatEnergy(energy.actualMWh)} (${formatPct(energy.gapPct, { signed: true })})`}
      />
    </div>
  );
}

function AtAGlance({ a }: { a: Accuracy }) {
  const f = a.forecast;
  const split = directionSplit(a.series);
  const worst = worstHour(a.series);
  return (
    <>
      <p className="card__eyebrow">Direction of the miss</p>
      <SplitBar over={split.over} under={split.under} />
      <FactList
        facts={[
          { label: 'Mean actual wind', value: formatPower(f.mean_actual) },
          { label: 'RMSE', value: formatPower(f.rmse), note: 'weights big misses' },
          { label: '9 in 10 hours miss by less than', value: formatPower(f.p90_abs_error) },
          { label: 'Typical error range (P10–P90)', value: `${formatPower(f.p10_error, { signed: true })} to ${formatPower(f.p90_error, { signed: true })}` },
          {
            label: 'Worst single hour',
            value: formatPower(worst?.error, { signed: true }),
            note: worst ? formatDayTime(worst.startTime) : undefined,
          },
        ]}
      />
    </>
  );
}

function OverviewContent({ a, stale, onOpenDay }: { a: Accuracy; stale: boolean; onOpenDay: (d: IsoDate) => void }) {
  return (
    <div className={`dash${stale ? ' is-stale' : ''}`} aria-busy={stale}>
      <OverviewKpis a={a} />
      <div className="grid">
        <Card
          span="span-8"
          title="Forecast vs actual"
          subtitle={`Forecast available at ${a.cutoff} on D-1 against metered wind · GW, hourly`}
          caption="Where orange dips below blue, wind under-delivered and the gap was bought back intraday or settled at imbalance prices."
        >
          <ForecastActualChart series={a.series} />
        </Card>
        <Card span="span-4" title="At a glance" subtitle={`${a.forecast.n.toLocaleString('en-GB')} delivery hours`}>
          <AtAGlance a={a} />
        </Card>
        <Card
          span="span-8"
          title="Error heatmap"
          subtitle="Forecast − actual for every delivery hour · rows are days, columns UK hours"
          caption="Red runs of hours are sustained shortfalls. Click a date to open that day's decision."
        >
          <ErrorHeatmap series={a.series} onOpenDay={onOpenDay} />
        </Card>
        <Card span="span-4" title="Model leaderboard" subtitle="Hourly MAE over the range; shorter is better">
          <ModelComparisonChart a={a} />
          <FactList
            facts={[
              { label: 'Forecast vs persistence', value: formatPct(a.skill.vsPersistence_pct, { signed: true, digits: 0 }), note: 'MAE skill' },
              { label: 'Forecast vs same hour D-2', value: formatPct(a.skill.vsSameHourD2_pct, { signed: true, digits: 0 }), note: 'MAE skill' },
              { label: 'P50 vs raw forecast', value: formatPct(a.skill.adjustedVsForecast_pct, { signed: true, digits: 0 }), note: 'MAE cut' },
            ]}
          />
        </Card>
        <Card
          span="span-6"
          title="Daily error"
          subtitle="Per delivery day · GW"
          caption="Runs of red days point to a systematic bias rather than noise."
          table={<DayTable rows={a.byDay} />}
        >
          <DailyErrorChart days={a.byDay} />
        </Card>
        <Card
          span="span-6"
          title="Cumulative energy"
          subtitle="Running total of forecast and actual wind energy"
          caption="The widening wedge is energy you planned on that never arrived; it has to be covered elsewhere."
        >
          <CumulativeEnergyChart days={a.byDay} />
        </Card>
        <Card span="span-6" title="Worst delivery days" subtitle="Ranked; open a day to see what the desk saw at the cutoff">
          <WorstDays days={a.byDay} onOpenDay={onOpenDay} />
        </Card>
        <Card
          span="span-6"
          title="Forecast vs actual, hour by hour"
          subtitle="Each dot is one delivery hour · GW"
          caption={`${formatPct(directionSplit(a.series).overPct, { digits: 0 })} of hours sit below the diagonal (forecast above outturn). The further right a red dot sits, the windier the hour it overshot.`}
        >
          <ScatterFit series={a.series} />
        </Card>
      </div>
    </div>
  );
}

interface OverviewPageProps {
  start: IsoDate;
  end: IsoDate;
  cutoff: HhMm;
  onOpenDay: (date: IsoDate) => void;
}

export function OverviewPage({ start, end, cutoff, onOpenDay }: OverviewPageProps) {
  const { data, error, loading, retry } = useAccuracy(start, end, cutoff);
  if (error) return <ErrorState error={error} onRetry={retry} />;
  return (
    <>
      {loading && <LoadingStatus label="Loading dashboard" />}
      {data ? <OverviewContent a={data} stale={loading} onOpenDay={onOpenDay} /> : <DashSkeleton />}
    </>
  );
}
