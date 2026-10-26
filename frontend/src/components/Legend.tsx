export type LegendKind = 'line' | 'dashed' | 'thin' | 'band' | 'bar';

export interface LegendItem {
  label: string;
  color: string;
  kind: LegendKind;
}

function Key({ color, kind }: Omit<LegendItem, 'label'>) {
  return (
    <svg className="legend__key" viewBox="0 0 16 10" aria-hidden focusable={false}>
      {kind === 'band' && <rect x="0" y="1" width="16" height="8" rx="2" fill={color} fillOpacity={0.2} />}
      {kind === 'bar' && <rect x="3" y="0" width="10" height="10" rx="2" fill={color} />}
      {kind === 'line' && <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth={2.5} strokeLinecap="round" />}
      {kind === 'thin' && <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth={1.25} strokeLinecap="round" />}
      {kind === 'dashed' && <line x1="0" y1="5" x2="16" y2="5" stroke={color} strokeWidth={1.5} strokeDasharray="3 2" />}
    </svg>
  );
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.label} className="legend__item">
          <Key color={item.color} kind={item.kind} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
