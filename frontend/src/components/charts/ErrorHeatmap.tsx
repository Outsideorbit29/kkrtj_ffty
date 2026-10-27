import { useMemo, useState } from 'react';
import type { IsoDate, SeriesPoint } from '../../api/types';
import { divergingStep, heatmapRows, type HeatCell } from '../../lib/dashboard';
import { formatCalendarDate, formatCalendarTick } from '../../lib/dates';
import { formatPower, hourLabel } from '../../lib/format';

const STEPS = 4;
/** Errors beyond ±4 GW share the darkest step. */
const MAX_MW = 4000;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const stepClass = (cell: HeatCell | null) => {
  if (!cell || cell.error === null) return 'heat__cell heat__cell--na';
  const s = divergingStep(cell.error, MAX_MW, STEPS);
  return `heat__cell heat__cell--${s > 0 ? `p${s}` : s < 0 ? `n${-s}` : '0'}`;
};

function Readout({ cell }: { cell: HeatCell | null }) {
  if (!cell) return <p className="heat__readout heat__readout--idle">Hover a cell for the hour's numbers · click a date to open that day</p>;
  return (
    <p className="heat__readout">
      <strong>
        {formatCalendarDate(cell.date)} {hourLabel(cell.hour)}
      </strong>
      <span>Forecast {formatPower(cell.forecast)}</span>
      <span>Actual {formatPower(cell.actual)}</span>
      <span>
        Error <strong>{formatPower(cell.error, { signed: true })}</strong>
      </span>
    </p>
  );
}

/** Scale legend: under-forecast steps, zero, over-forecast steps. */
function HeatLegend() {
  const gw = (MAX_MW / 1000).toString();
  return (
    <div className="heat__legend" aria-hidden>
      <span>Under −{gw} GW</span>
      <span className="heat__ramp">
        {[4, 3, 2, 1].map((s) => (
          <span key={`n${s}`} className={`heat__cell heat__cell--n${s}`} />
        ))}
        <span className="heat__cell heat__cell--0" />
        {[1, 2, 3, 4].map((s) => (
          <span key={`p${s}`} className={`heat__cell heat__cell--p${s}`} />
        ))}
      </span>
      <span>Over +{gw} GW</span>
    </div>
  );
}

/** Decision-time forecast error for every delivery hour: rows are days, columns UK hours. */
export function ErrorHeatmap({ series, onOpenDay }: { series: SeriesPoint[]; onOpenDay?: (date: IsoDate) => void }) {
  const rows = useMemo(() => heatmapRows(series), [series]);
  const [hover, setHover] = useState<HeatCell | null>(null);
  if (rows.length === 0) return <p className="empty">No data in this range.</p>;

  return (
    <div className="heat" onMouseLeave={() => setHover(null)}>
      <Readout cell={hover} />
      <div className="heat__grid" role="img" aria-label="Heatmap of hourly forecast error by day and hour; the data explorer lists every value.">
        <span />
        {HOURS.map((h) => (
          <span key={h} className="heat__hour">
            {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
          </span>
        ))}
        {rows.map(({ date, cells }) => (
          <div key={date} className="heat__row">
            {onOpenDay ? (
              <button type="button" className="heat__day" onClick={() => onOpenDay(date)} title={`Open ${formatCalendarDate(date)}`}>
                {formatCalendarTick(date)}
              </button>
            ) : (
              <span className="heat__day">{formatCalendarTick(date)}</span>
            )}
            {cells.map((cell, h) => (
              <span key={h} className={stepClass(cell)} onMouseEnter={() => setHover(cell)} />
            ))}
          </div>
        ))}
      </div>
      <HeatLegend />
    </div>
  );
}
