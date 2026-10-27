import type { ComponentType, SVGProps } from 'react';
import { IconAccuracy, IconDecision, IconOverview, IconTable } from './Icons';

export type View = 'overview' | 'decision' | 'accuracy' | 'explorer';

export interface NavDef {
  key: View;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV: NavDef[] = [
  { key: 'overview', label: 'Overview', hint: 'Month at a glance', icon: IconOverview },
  { key: 'decision', label: 'Day-ahead decision', hint: 'One delivery day', icon: IconDecision },
  { key: 'accuracy', label: 'Forecast accuracy', hint: 'Error deep dive', icon: IconAccuracy },
  { key: 'explorer', label: 'Data explorer', hint: 'Every hour, filterable', icon: IconTable },
];

export const isView = (value: string): value is View => NAV.some((n) => n.key === value);
