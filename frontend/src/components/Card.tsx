import { useState, type ReactNode } from 'react';
import { Segmented } from './Segmented';

interface CardProps {
  title: string;
  subtitle?: ReactNode;
  /** Extra controls in the card header (left of the chart/table toggle). */
  actions?: ReactNode;
  /** Small print under the chart, e.g. how the band was built. */
  footnote?: ReactNode;
  /** One line on what the chart means for the buying decision. */
  caption?: ReactNode;
  /** Tabular equivalent of the chart; adds a Chart / Table toggle to the header. */
  table?: ReactNode;
  /** Grid span class, e.g. `span-8`. */
  span?: string;
  className?: string;
  children: ReactNode;
}

type Mode = 'chart' | 'table';

/** A dashboard panel: title row with actions, chart (or its table), footnote, buying insight. */
export function Card({ title, subtitle, actions, footnote, caption, table, span = 'span-12', className, children }: CardProps) {
  const [mode, setMode] = useState<Mode>('chart');
  const showTable = Boolean(table) && mode === 'table';

  return (
    <section className={`card ${span}${className ? ` ${className}` : ''}`} aria-label={title}>
      <header className="card__head">
        <div className="card__titles">
          <h3 className="card__title">{title}</h3>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
        {(actions || table) && (
          <div className="card__actions">
            {actions}
            {table && (
              <Segmented
                label={`${title}: view as`}
                value={mode}
                onChange={setMode}
                options={[
                  { key: 'chart', label: 'Chart' },
                  { key: 'table', label: 'Table' },
                ]}
              />
            )}
          </div>
        )}
      </header>
      <div className="card__body">{showTable ? table : children}</div>
      {footnote && !showTable && <p className="card__footnote">{footnote}</p>}
      {caption && (
        <div className="insight">
          <svg className="insight__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable={false}>
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 7v4.2M8 4.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <p>
            <span className="insight__label">For buying: </span>
            {caption}
          </p>
        </div>
      )}
    </section>
  );
}
