import { useEffect, useState } from 'react';
import { readChartTheme, type ChartTheme } from '../lib/theme';

/** Chart colours resolved from CSS variables; re-read when the OS scheme or the theme toggle flips. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(readChartTheme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(readChartTheme());
    query.addEventListener('change', onChange);
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      query.removeEventListener('change', onChange);
      observer.disconnect();
    };
  }, []);

  return theme;
}
