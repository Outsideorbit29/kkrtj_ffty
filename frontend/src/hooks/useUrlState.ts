import { useCallback, useEffect, useState } from 'react';

function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * A string state mirrored to a URL query parameter, so a view can be bookmarked or shared.
 * The parameter is removed when the value equals `fallback`.
 */
export function useUrlState(name: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readParam(name) ?? fallback);

  useEffect(() => {
    const onPop = () => setValue(readParam(name) ?? fallback);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [name, fallback]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      const url = new URL(window.location.href);
      if (next === fallback) url.searchParams.delete(name);
      else url.searchParams.set(name, next);
      window.history.replaceState(null, '', url);
    },
    [name, fallback],
  );

  return [value, update];
}
