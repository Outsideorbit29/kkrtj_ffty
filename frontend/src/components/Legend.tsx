export type LegendKind = 'line' | 'dashed' | 'thin' | 'band' | 'bar';

export interface LegendItem {
  label: string;
  color: string;
  kind: LegendKind;
}

/** The 18×10 series key shared by legends and tooltips. */
export function LegendKey({ color, kind }: Omit<LegendItem, 'label'>) {
  return (
    <svg className="legend__key" viewBox="0 0 18 10" width="18" height="10" aria-hidden focusable={false}>
      {kind === 'band' && <rect x="0" y="1" width="18" height="8" rx="0" fill={color} fillOpacity={0.2} />}
      {kind === 'bar' && <rect x="4" y="0" width="10" height="10" rx="1" fill={color} />}
      {kind === 'line' && <line x1="1" y1="5" x2="17" y2="5" stroke={color} strokeWidth={2} strokeLinecap="round" />}
      {kind === 'thin' && <line x1="1" y1="5" x2="17" y2="5" stroke={color} strokeWidth={1} strokeLinecap="round" />}
      {kind === 'dashed' && <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth={1.5} strokeDasharray="3 2" />}
    </svg>
  );
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.label} className="legend__item">
          <LegendKey color={item.color} kind={item.kind} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
