import { useCallback, useSyncExternalStore } from 'react';

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Whether a CSS media query matches, kept in sync as it changes. False where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () => canMatch() && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
