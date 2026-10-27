import type { ReactNode } from 'react';
import { Sparkline, type SparkKind } from './Sparkline';

export type TagTone = 'neutral' | 'bad' | 'good';

export interface StatTag {
  text: string;
  tone: TagTone;
}

interface StatCardProps {
  label: string;
  value: string;
  detail?: ReactNode;
  tag?: StatTag;
  /** Trend under the value, e.g. the daily values behind a monthly figure. */
  spark?: { values: number[]; kind?: SparkKind; color?: string; caption?: string };
  /** Progress bar: value against max, with an optional target tick (e.g. nominal coverage). */
  meter?: { value: number; max: number; target?: number };
  /** Accent card: the view's lead figure, tied to the forecast series colour. */
  accent?: boolean;
}

/** Every number followed by a unit ("258.2 GWh"); the unit is set smaller. */
const NUMBER_UNIT = /(\d)\s([A-Za-z]+)(?=\s|$)/g;

export function Value({ value }: { value: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of value.matchAll(NUMBER_UNIT)) {
    const unit = m[2] ?? '';
    const unitStart = (m.index ?? 0) + 2;
    parts.push(value.slice(last, unitStart));
    parts.push(
      <span key={unitStart} className="stat__unit">
        {unit}
      </span>,
    );
    last = unitStart + unit.length;
  }
  parts.push(value.slice(last));
  return <span className="stat__value">{parts}</span>;
}

const GLYPHS: Record<TagTone, ReactNode> = {
  bad: <path d="M5 1 L9.5 9 H0.5 Z" fill="currentColor" />,
  good: (
    <path
      d="M1.5 5.2 L4 7.7 L8.7 2.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  neutral: <circle cx="5" cy="5" r="3.5" fill="currentColor" />,
};

/** Status pill with a shape glyph, so the tone never rests on colour alone. */
export function Status({ text, tone }: StatTag) {
  return (
    <span className={`status status--${tone}`}>
      <svg className="status__glyph" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
        {GLYPHS[tone]}
      </svg>
      {text}
    </span>
  );
}

function Meter({ value, max, target }: { value: number; max: number; target?: number }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className="meter" aria-hidden>
      <div className="meter__fill" style={{ width: pct(value) }} />
      {target !== undefined && <div className="meter__target" style={{ left: pct(target) }} />}
    </div>
  );
}

export function StatCard({ label, value, detail, tag, spark, meter, accent = false }: StatCardProps) {
  return (
    <div className={`stat${accent ? ' stat--accent' : ''}`}>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {tag && <Status {...tag} />}
      </div>
      <Value value={value} />
      {spark && (
        <div className="stat__spark">
          <Sparkline values={spark.values} kind={spark.kind} color={spark.color} />
          {spark.caption && <span className="stat__spark-caption">{spark.caption}</span>}
        </div>
      )}
      {meter && <Meter {...meter} />}
      {detail && <span className="stat__detail">{detail}</span>}
    </div>
  );
}
