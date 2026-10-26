import type { ReactNode } from 'react';

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
      <div className="tooltip__title">{title}</div>
      {rows.map((row) => (
        <div key={row.name} className="tooltip__row">
          <svg width="14" height="8" aria-hidden focusable={false}>
            {row.color && (
              <line
                x1="1"
                y1="4"
                x2="13"
                y2="4"
                stroke={row.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={row.dashed ? '3 3' : undefined}
              />
            )}
          </svg>
          <span className="tooltip__name">{row.name}</span>
          <span className="tooltip__value">{row.value}</span>
        </div>
      ))}
      {note && <div className="tooltip__note">{note}</div>}
    </div>
  );
}
