import type { CutoffPreset, HhMm } from '../api/types';
import { CutoffSelector } from './CutoffSelector';
import { WindMark } from './Icons';
import { Tabs, type TabDef } from './Tabs';

interface AppHeaderProps<K extends string> {
  cutoff: HhMm;
  presets: CutoffPreset[];
  onCutoffChange: (cutoff: HhMm) => void;
  tabs: TabDef<K>[];
  activeTab: K;
  onTabChange: (key: K) => void;
}

export function AppHeader<K extends string>(props: AppHeaderProps<K>) {
  return (
    <header className="app-header">
      <div className="container app-header__top">
        <div className="brand">
          <WindMark className="brand__mark" />
          <div>
            <h1 className="brand__name">Wind Forecast Desk</h1>
            <p className="brand__tagline">GB national wind forecast at day-ahead decision time, and how far to trust it</p>
          </div>
        </div>
        {props.presets.length > 0 && (
          <CutoffSelector value={props.cutoff} presets={props.presets} onChange={props.onCutoffChange} />
        )}
      </div>
      <div className="container">
        <Tabs tabs={props.tabs} active={props.activeTab} onChange={props.onTabChange} label="Views" />
      </div>
    </header>
  );
}
