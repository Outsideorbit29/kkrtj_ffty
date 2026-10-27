import type { ReactNode } from 'react';
import { LegendKey } from './Legend';

export interface TooltipRow {
  name: string;
  value: string;
  /** Series colour for the line key; omit for derived values. */
  color?: string;
  dashed?: boolean;
}

export function TooltipFrame({ title, rows, note }: { title: string; rows: TooltipRow[]; note?: ReactNode }) {
  return (
    <div className="tooltip">
      <div className="tooltip__title label">{title}</div>
      {rows.map((row) => (
        <div key={row.name} className="tooltip__row">
          {row.color ? <LegendKey color={row.color} kind={row.dashed ? 'dashed' : 'line'} /> : <span aria-hidden />}
          <span className="tooltip__name">{row.name}</span>
          <span className="tooltip__value">{row.value}</span>
        </div>
      ))}
      {note && <div className="tooltip__note">{note}</div>}
    </div>
  );
}
