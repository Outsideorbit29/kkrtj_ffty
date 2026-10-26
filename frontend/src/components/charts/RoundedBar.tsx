/**
 * Bar shape with a 4px rounded data end and a square baseline end, for positive and negative
 * values alike. Recharts passes a negative `height` for bars below the baseline.
 */
export interface RoundedBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  value?: number | [number, number];
}

const RADIUS = 4;

export function RoundedBar({ x = 0, y = 0, width = 0, height = 0, fill, value }: RoundedBarProps) {
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  if (h === 0 || width <= 0) return null;
  const r = Math.min(RADIUS, h, width / 2);
  const numeric = Array.isArray(value) ? value[1] - value[0] : (value ?? 0);
  const right = x + width;
  const bottom = top + h;
  const d =
    numeric >= 0
      ? `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${right - r}Q${right},${top} ${right},${top + r}V${bottom}Z`
      : `M${x},${top}V${bottom - r}Q${x},${bottom} ${x + r},${bottom}H${right - r}Q${right},${bottom} ${right},${bottom - r}V${top}Z`;
  return <path d={d} fill={fill} />;
}
