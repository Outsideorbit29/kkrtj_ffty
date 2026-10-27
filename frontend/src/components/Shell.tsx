import type { ReactNode } from 'react';
import type { Meta } from '../api/types';
import { useTheme } from '../hooks/useTheme';
import { formatCalendarTick } from '../lib/dates';
import { formatDayTime } from '../lib/format';
import { IconMoon, IconSun, WindMark } from './Icons';
import { NAV, type View } from './nav';

interface SidebarProps {
  active: View;
  onChange: (view: View) => void;
  meta: Meta | undefined;
}

export function Sidebar({ active, onChange, meta }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <WindMark className="sidebar__logo" />
        <div>
          <h1 className="sidebar__name">Wind Forecast Desk</h1>
          <p className="sidebar__sub">GB day-ahead purchasing</p>
        </div>
      </div>
      <nav className="sidebar__nav" aria-label="Views">
        <p className="sidebar__section">Dashboards</p>
        <ul className="nav">
          {NAV.map(({ key, label, hint, icon: Icon }) => (
            <li key={key}>
              <button
                type="button"
                className="nav__item"
                aria-current={key === active ? 'page' : undefined}
                onClick={() => onChange(key)}
              >
                <Icon className="nav__icon" />
                <span className="nav__text">
                  <span className="nav__label">{label}</span>
                  <span className="nav__hint">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {meta && (
        <dl className="sidebar__facts">
          <div>
            <dt>Delivery window</dt>
            <dd>
              {formatCalendarTick(meta.deliveryStart)} – {formatCalendarTick(meta.deliveryEnd)}
            </dd>
          </div>
          <div>
            <dt>Forecast runs</dt>
            <dd>{meta.forecastRunTimesUtc.length} a day (UTC)</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>
              Elexon {meta.dataSource}
              {meta.snapshotCreatedUtc && <span className="sidebar__muted"> · {formatDayTime(meta.snapshotCreatedUtc)}</span>}
            </dd>
          </div>
        </dl>
      )}
    </aside>
  );
}

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
}

interface TopbarProps {
  title: string;
  subtitle: ReactNode;
  /** Global filters for the view: cutoff, date or range. */
  children?: ReactNode;
}

export function Topbar({ title, subtitle, children }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__titles">
        <p className="topbar__crumb">Wind Forecast Desk / {title}</p>
        <h2 className="topbar__title">{title}</h2>
        <p className="topbar__subtitle">{subtitle}</p>
      </div>
      <div className="topbar__filters">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
