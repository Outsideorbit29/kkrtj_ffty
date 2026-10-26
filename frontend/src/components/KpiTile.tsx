import type { ReactNode } from 'react';

export type TagTone = 'neutral' | 'bad' | 'good';

interface KpiTileProps {
  label: string;
  value: string;
  detail?: ReactNode;
  tag?: { text: string; tone: TagTone };
  emphasis?: boolean;
}

export function KpiTile({ label, value, detail, tag, emphasis = false }: KpiTileProps) {
  return (
    <div className={`kpi${emphasis ? ' kpi--emphasis' : ''}`}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      {tag && <span className={`kpi__tag kpi__tag--${tag.tone}`}>{tag.text}</span>}
      {detail && <span className="kpi__detail">{detail}</span>}
    </div>
  );
}
