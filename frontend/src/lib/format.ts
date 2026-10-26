/** Number and time formatting. All wall-clock output is Europe/London. */

const LONDON = 'Europe/London';
const MINUS = '−';

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, weekday: 'short', day: 'numeric', month: 'short' });
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: 'numeric', hourCycle: 'h23' });

function fixed(value: number, digits: number): string {
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function withSign(text: string, value: number, signed: boolean): string {
  if (value < 0) return `${MINUS}${text}`;
  return signed && value > 0 ? `+${text}` : text;
}

/** 850 → "850 MW", 12 345 → "12.3 GW". */
export function formatPower(mw: number | null | undefined, { signed = false } = {}): string {
  if (mw == null || Number.isNaN(mw)) return '–';
  const abs = Math.abs(mw);
  const text = abs >= 1000 ? `${fixed(abs / 1000, 1)} GW` : `${fixed(abs, 0)} MW`;
  return withSign(text, Math.round(mw), signed);
}

/** Always in MW, for tables where columns must align: 12 345 → "12,345". */
export function formatMw(mw: number | null | undefined, { signed = false } = {}): string {
  if (mw == null || Number.isNaN(mw)) return '–';
  return withSign(fixed(Math.abs(mw), 0), Math.round(mw), signed);
}

/** 900 → "900 MWh", 280 000 → "280.0 GWh". */
export function formatEnergy(mwh: number | null | undefined, { signed = false } = {}): string {
  if (mwh == null || Number.isNaN(mwh)) return '–';
  const abs = Math.abs(mwh);
  const text = abs >= 1000 ? `${fixed(abs / 1000, 1)} GWh` : `${fixed(abs, 0)} MWh`;
  return withSign(text, Math.round(mwh), signed);
}

export function formatPct(value: number | null | undefined, { signed = false, digits = 1 } = {}): string {
  if (value == null || Number.isNaN(value)) return '–';
  return withSign(`${fixed(Math.abs(value), digits)}%`, value, signed);
}

/** Axis ticks: power in GW without unit (the axis label carries it). */
export function gwTick(mw: number): string {
  const gw = mw / 1000;
  const text = Math.abs(gw).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return withSign(text, gw, false);
}

export const toMs = (iso: string): number => Date.parse(iso);

/** "07:30" */
export const formatTime = (iso: string | number): string => timeFmt.format(new Date(iso));

/** "Wed 14 Jan" */
export const formatDay = (iso: string | number): string => dayFmt.format(new Date(iso));

/** "Wed 14 Jan, 07:30" */
export const formatDayTime = (iso: string | number): string => dayTimeFmt.format(new Date(iso));

/** London hour of day, 0-23. */
export const londonHour = (iso: string | number): number => Number(hourFmt.format(new Date(iso)));

/** 110 → "1h 50m", 45 → "45m", 1500 → "25h 0m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** 0 → "00:00", 23 → "23:00". */
export const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** Histogram bin in MW: "+500 to +1,000 MW". */
export const formatBin = (bin: { from: number; to: number }): string =>
  `${formatMw(bin.from, { signed: true })} to ${formatMw(bin.to, { signed: true })} MW`;
