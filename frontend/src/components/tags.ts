import type { BandCoverage } from '../api/types';
import { formatEnergy, formatPct } from '../lib/format';
import type { StatTag } from './StatCard';

export function skillTag(pct: number): StatTag {
  return pct > 0 ? { text: 'Beats baseline', tone: 'good' } : { text: 'Worse than baseline', tone: 'bad' };
}

export function biasTag(bias: number): StatTag {
  if (bias > 0) return { text: 'Over-forecast', tone: 'bad' };
  if (bias < 0) return { text: 'Under-forecast', tone: 'neutral' };
  return { text: 'Unbiased', tone: 'good' };
}

export function bandTag(band: BandCoverage): StatTag | undefined {
  if (band.coverage_pct == null) return undefined;
  const gap = band.coverage_pct - band.nominal_pct;
  if (gap < -5) return { text: 'Too narrow', tone: 'bad' };
  return gap > 5 ? { text: 'Conservative', tone: 'good' } : { text: 'Calibrated', tone: 'good' };
}

/** % MAE improvement of the bias-corrected P50 over the raw forecast. */
export function adjustedTag(gainPct: number | null): StatTag | undefined {
  if (gainPct == null) return undefined;
  const size = formatPct(Math.abs(gainPct), { digits: 0 });
  return gainPct > 0 ? { text: `${size} better`, tone: 'good' } : { text: `${size} worse`, tone: 'bad' };
}

export function energyErrorTag(errorMWh: number | null): StatTag | undefined {
  if (errorMWh == null) return undefined;
  if (errorMWh > 0) return { text: `Short ${formatEnergy(errorMWh)}`, tone: 'bad' };
  if (errorMWh < 0) return { text: `Surplus ${formatEnergy(-errorMWh)}`, tone: 'neutral' };
  return { text: 'Spot on', tone: 'good' };
}
