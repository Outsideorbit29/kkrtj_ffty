import { useCallback, type ReactNode } from 'react';
import type { IsoDate, Meta } from './api/types';
import { AppFooter } from './components/AppFooter';
import { CutoffSelector } from './components/CutoffSelector';
import { DateRangePicker } from './components/DateRangePicker';
import { DateStepper } from './components/DateStepper';
import { NAV, isView, type View } from './components/nav';
import { Sidebar, Topbar } from './components/Shell';
import { DashSkeleton, ErrorState, LoadingStatus } from './components/States';
import { useMeta } from './hooks/api';
import { useUrlState } from './hooks/useUrlState';
import { addDays, clampDate, formatCalendarDate, formatCalendarTick, isHhMm, isIsoDate } from './lib/dates';
import { AccuracyPage } from './pages/AccuracyPage';
import { DecisionPage } from './pages/DecisionPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { OverviewPage } from './pages/OverviewPage';

function Layout({ view, onView, meta, title, subtitle, filters, children }: {
  view: View;
  onView: (v: View) => void;
  meta: Meta | undefined;
  title: string;
  subtitle: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar active={view} onChange={onView} meta={meta} />
      <div className="shell__main">
        <Topbar title={title} subtitle={subtitle}>
          {filters}
        </Topbar>
        <main id="main" className="content">
          {children}
        </main>
        <AppFooter meta={meta} />
      </div>
    </div>
  );
}

function Desk({ meta }: { meta: Meta }) {
  const [rawView, setView] = useUrlState('view', 'overview');
  const [rawCutoff, setCutoff] = useUrlState('cutoff', meta.defaultCutoff);
  const [rawDecision, setDecision] = useUrlState('decision', meta.decisionStart);
  const [rawStart, setStart] = useUrlState('from', meta.deliveryStart);
  const [rawEnd, setEnd] = useUrlState('to', meta.deliveryEnd);

  const view: View = isView(rawView) ? rawView : 'overview';
  const cutoff = isHhMm(rawCutoff) ? rawCutoff : meta.defaultCutoff;
  const decisionDate = isIsoDate(rawDecision) ? clampDate(rawDecision, meta.decisionStart, meta.decisionEnd) : meta.decisionStart;
  const deliveryDate = addDays(decisionDate, 1);
  const clampDelivery = (d: string, fallback: string) => (isIsoDate(d) ? clampDate(d, meta.deliveryStart, meta.deliveryEnd) : fallback);
  const start = clampDelivery(rawStart, meta.deliveryStart);
  const end = clampDelivery(rawEnd, meta.deliveryEnd) < start ? start : clampDelivery(rawEnd, meta.deliveryEnd);

  const changeView = useCallback(
    (next: View) => {
      setView(next);
      window.scrollTo({ top: 0 });
    },
    [setView],
  );

  /** Drill-down from any chart or table: open the decision for delivery day `date`. */
  const openDay = useCallback(
    (date: IsoDate) => {
      setDecision(clampDate(addDays(date, -1), meta.decisionStart, meta.decisionEnd));
      changeView('decision');
    },
    [setDecision, changeView, meta.decisionStart, meta.decisionEnd],
  );

  const cutoffControl = <CutoffSelector value={cutoff} presets={meta.cutoffPresets} onChange={setCutoff} />;
  const rangeControl = (
    <DateRangePicker
      start={start}
      end={end}
      min={meta.deliveryStart}
      max={meta.deliveryEnd}
      onChange={(s, e) => {
        setStart(s);
        setEnd(e);
      }}
    />
  );
  const range = `${formatCalendarTick(start)} – ${formatCalendarTick(end)}`;
  const label = NAV.find((n) => n.key === view)?.label ?? '';

  const pages: Record<View, { subtitle: ReactNode; filters: ReactNode; body: ReactNode }> = {
    overview: {
      subtitle: `Delivery ${range} · decisions at ${cutoff} on the day before`,
      filters: (
        <>
          {rangeControl}
          {cutoffControl}
        </>
      ),
      body: <OverviewPage start={start} end={end} cutoff={cutoff} onOpenDay={openDay} />,
    },
    decision: {
      subtitle: `Buying for ${formatCalendarDate(deliveryDate)} · decision at ${cutoff} on ${formatCalendarDate(decisionDate)}`,
      filters: (
        <>
          <DateStepper label="Decision date (D-1)" value={decisionDate} min={meta.decisionStart} max={meta.decisionEnd} onChange={setDecision} />
          {cutoffControl}
        </>
      ),
      body: <DecisionPage meta={meta} deliveryDate={deliveryDate} cutoff={cutoff} onSelectDelivery={openDay} />,
    },
    accuracy: {
      subtitle: `How far the forecast you buy against has been from outturn · delivery ${range}`,
      filters: (
        <>
          {rangeControl}
          {cutoffControl}
        </>
      ),
      body: <AccuracyPage start={start} end={end} cutoff={cutoff} />,
    },
    explorer: {
      subtitle: `Every delivery hour, filterable and exportable · ${range}`,
      filters: (
        <>
          {rangeControl}
          {cutoffControl}
        </>
      ),
      body: <ExplorerPage start={start} end={end} cutoff={cutoff} onOpenDay={openDay} />,
    },
  };
  const page = pages[view];

  return (
    <Layout view={view} onView={changeView} meta={meta} title={label} subtitle={page.subtitle} filters={page.filters}>
      {page.body}
    </Layout>
  );
}

export function App() {
  const { data: meta, error, retry } = useMeta();

  if (meta) return <Desk meta={meta} />;
  return (
    <Layout view="overview" onView={() => undefined} meta={undefined} title="Overview" subtitle="Loading…">
      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : (
        <>
          <LoadingStatus label="Loading" />
          <DashSkeleton />
        </>
      )}
    </Layout>
  );
}
