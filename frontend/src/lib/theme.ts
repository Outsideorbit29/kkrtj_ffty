/** SVG chart colours. Values live in styles.css (:root) so light/dark is defined in one place. */
export interface ChartTheme {
  forecast: string;
  actual: string;
  /** Error magnitude (MAE): neutral, so blue only means forecast and blue/red only signed error. */
  error: string;
  over: string;
  under: string;
  muted: string;
  faint: string;
  grid: string;
  axis: string;
  text: string;
  surface: string;
}

const VARS: Record<keyof ChartTheme, string> = {
  forecast: '--series-forecast',
  actual: '--series-actual',
  error: '--series-error',
  over: '--diverge-over',
  under: '--diverge-under',
  muted: '--series-muted',
  faint: '--series-faint',
  grid: '--grid',
  axis: '--axis',
  text: '--text-muted',
  surface: '--surface-1',
};

export function readChartTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement);
  const entries = Object.entries(VARS).map(([key, cssVar]) => [key, style.getPropertyValue(cssVar).trim()]);
  return Object.fromEntries(entries) as ChartTheme;
}
