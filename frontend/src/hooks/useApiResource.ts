import { useCallback, useEffect, useState } from 'react';

export interface Resource<T> {
  /** Last successful result. Kept while a new request is in flight so views don't flash. */
  data: T | undefined;
  /** Error of the current request, if it failed. */
  error: Error | undefined;
  /** True while the current request is in flight (first load or refetch). */
  loading: boolean;
  retry: () => void;
}

interface Settled<T> {
  key?: string;
  data?: T;
  error?: Error;
}

/**
 * Runs `load` whenever `key` changes, aborting the previous request.
 * `key` must uniquely identify the request parameters.
 */
export function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({});
  const requestKey = `${key}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setSettled({ key: requestKey, data }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setSettled((prev) => ({ key: requestKey, data: prev.data, error }));
      },
    );
    return () => controller.abort();
    // `load` is intentionally excluded: `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const isCurrent = settled.key === requestKey;
  return { data: settled.data, error: isCurrent ? settled.error : undefined, loading: !isCurrent, retry };
}
