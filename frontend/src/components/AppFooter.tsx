import type { Meta } from '../api/types';
import { formatDayTime } from '../lib/format';

export function AppFooter({ meta }: { meta: Meta | undefined }) {
  const snapshot = meta?.snapshotCreatedUtc ? formatDayTime(meta.snapshotCreatedUtc) : undefined;
  return (
    <footer className="app-footer">
      <div className="container">
        <span>
          Data: <a href="https://bmrs.elexon.co.uk/" target="_blank" rel="noreferrer">Elexon BMRS</a> · FUELHH
          (wind outturn) and WINDFOR (national wind forecast)
          {meta && ` · source: ${meta.dataSource}`}
          {snapshot && `, captured ${snapshot}`}
        </span>
        <span>All times UK local (Europe/London) · power in MW/GW, energy in MWh/GWh</span>
      </div>
    </footer>
  );
}
