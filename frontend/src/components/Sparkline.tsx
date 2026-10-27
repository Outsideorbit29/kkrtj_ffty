export type SparkKind = 'line' | 'area' | 'diverging';

interface SparklineProps {
  values: number[];
  kind?: SparkKind;
  /** CSS colour for line/area; diverging bars use the over/under tokens. */
  color?: string;
}

const W = 120;
const H = 36;

/** A tiny trend glyph for stat cards. Decorative: the card's text carries the numbers. */
export function Sparkline({ values, kind = 'line', color = 'var(--series-forecast)' }: SparklineProps) {
  if (values.length < 2) return null;

  if (kind === 'diverging') {
    const max = Math.max(...values.map(Math.abs)) || 1;
    const mid = H / 2;
    const step = W / values.length;
    const bw = Math.max(1, step - 1.5);
    return (
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable={false}>
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--axis)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => {
          const h = Math.max(1, (Math.abs(v) / max) * (mid - 1));
          return (
            <rect
              key={i}
              x={i * step}
              y={v >= 0 ? mid - h : mid}
              width={bw}
              height={h}
              rx="0.8"
              fill={v >= 0 ? 'var(--diverge-over)' : 'var(--diverge-under)'}
            />
          );
        })}
      </svg>
    );
  }

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - lo) / span) * (H - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable={false}>
      {kind === 'area' && <path d={`${d}L${W},${H}L0,${H}Z`} fill={color} fillOpacity={0.12} />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
