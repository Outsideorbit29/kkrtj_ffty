import type { Meta } from './api/types';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { CardSkeleton, ErrorState, KpiSkeleton, LoadingStatus } from './components/States';
import { panelId, tabId } from './components/tabIds';
import type { TabDef } from './components/Tabs';
import { useMeta } from './hooks/api';
import { useUrlState } from './hooks/useUrlState';
import { isHhMm } from './lib/dates';
import { AccuracyPage } from './pages/AccuracyPage';
import { DecisionPage } from './pages/DecisionPage';

type View = 'decision' | 'accuracy';

const TABS: TabDef<View>[] = [
  { key: 'decision', label: 'Day-ahead decision' },
  { key: 'accuracy', label: 'Forecast accuracy' },
];

const isView = (value: string): value is View => TABS.some((t) => t.key === value);

function Desk({ meta }: { meta: Meta }) {
  const [rawView, setView] = useUrlState('view', 'decision');
  const [rawCutoff, setCutoff] = useUrlState('cutoff', meta.defaultCutoff);
  const view: View = isView(rawView) ? rawView : 'decision';
  const cutoff = isHhMm(rawCutoff) ? rawCutoff : meta.defaultCutoff;

  return (
    <>
      <AppHeader
        cutoff={cutoff}
        presets={meta.cutoffPresets}
        onCutoffChange={setCutoff}
        tabs={TABS}
        activeTab={view}
        onTabChange={setView}
      />
      <main id={panelId(view)} role="tabpanel" aria-labelledby={tabId(view)} className="container">
        {view === 'decision' ? <DecisionPage meta={meta} cutoff={cutoff} /> : <AccuracyPage meta={meta} cutoff={cutoff} />}
      </main>
      <AppFooter meta={meta} />
    </>
  );
}

export function App() {
  const { data: meta, error, retry } = useMeta();

  if (meta) return <Desk meta={meta} />;
  return (
    <>
      <AppHeader cutoff="" presets={[]} onCutoffChange={() => undefined} tabs={TABS} activeTab="decision" onTabChange={() => undefined} />
      <main className="container">
        {error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : (
          <div className="stack">
            <LoadingStatus label="Loading" />
            <KpiSkeleton count={6} />
            <CardSkeleton height={320} />
          </div>
        )}
      </main>
      <AppFooter meta={undefined} />
    </>
  );
}
