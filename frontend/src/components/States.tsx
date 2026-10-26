import { ApiError } from '../api/client';

export function Skeleton({ height, width = '100%' }: { height: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden />;
}

export function KpiSkeleton({ count }: { count: number }) {
  return (
    <div className="kpi-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi">
          <Skeleton height={14} width="60%" />
          <Skeleton height={28} width="75%" />
          <Skeleton height={12} width="90%" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height }: { height: number }) {
  return (
    <div className="card" aria-hidden>
      <Skeleton height={18} width="40%" />
      <div className="skeleton-gap" />
      <Skeleton height={height} />
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
