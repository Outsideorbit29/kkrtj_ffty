import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  /** One line on what the chart means for the buying decision. */
  caption?: ReactNode;
  /** Accessible tabular equivalent, rendered in a collapsed disclosure. */
  table?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, caption, table, children }: ChartCardProps) {
  return (
    <section className="card" aria-label={title}>
      <div className="card__head">
        <div>
          <h3 className="card__title">{title}</h3>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
      </div>
      {children}
      {table && (
        <details className="disclosure disclosure--small card__table">
          <summary>Show data table</summary>
          {table}
        </details>
      )}
      {caption && (
        <p className="card__caption">
          <strong>For buying</strong>
          <span>{caption}</span>
        </p>
      )}
    </section>
  );
}
