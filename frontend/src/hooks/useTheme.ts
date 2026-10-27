import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark';

const KEY = 'wind-desk-theme';

function stored(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const systemDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Light/dark choice stamped on <html data-theme>, remembered per browser; follows the OS until toggled. */
export function useTheme(): [ThemeChoice, () => void] {
  const [choice, setChoice] = useState<ThemeChoice | null>(stored);
  const effective: ThemeChoice = choice ?? (systemDark() ? 'dark' : 'light');

  useEffect(() => {
    if (choice) document.documentElement.dataset.theme = choice;
    else delete document.documentElement.dataset.theme;
  }, [choice]);

  const toggle = useCallback(() => {
    const next: ThemeChoice = effective === 'dark' ? 'light' : 'dark';
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  }, [effective]);

  return [effective, toggle];
}
