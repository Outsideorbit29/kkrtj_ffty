import { ApiError } from '../api/client';

export function Skeleton({ height, width = '100%' }: { height: number | string; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden />;
}

/** Placeholder in the shape of a dashboard: a row of stat cards and a grid of panels. */
export function DashSkeleton({ kpis = 6, panels = [8, 4, 6, 6] }: { kpis?: number; panels?: number[] }) {
  return (
    <div className="dash" aria-hidden>
      <div className="kpis">
        {Array.from({ length: kpis }, (_, i) => (
          <div key={i} className="stat">
            <Skeleton height={12} width="55%" />
            <Skeleton height={30} width="45%" />
            <Skeleton height={12} width="80%" />
          </div>
        ))}
      </div>
      <div className="grid">
        {panels.map((span, i) => (
          <div key={i} className={`card span-${span}`}>
            <Skeleton height={16} width="40%" />
            <div className="skeleton-gap" />
            <Skeleton height={260} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Announces loading to screen readers; skeletons themselves are aria-hidden. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <p className="visually-hidden" role="status">
      {label}
    </p>
  );
}

function describe(error: Error): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 0) return { title: 'Service unavailable', detail: error.message };
    if (error.status === 404) return { title: 'No data for this selection', detail: error.message };
    if (error.status === 400) return { title: 'Invalid selection', detail: error.message };
    return { title: `Server error (${error.status})`, detail: error.message };
  }
  return { title: 'Something went wrong', detail: error.message };
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { title, detail } = describe(error);
  return (
    <div className="error-state" role="alert">
      <span className="error-state__title">{title}</span>
      <span className="error-state__detail">{detail}</span>
      {onRetry && (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
