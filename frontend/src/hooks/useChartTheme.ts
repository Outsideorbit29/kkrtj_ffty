import { useEffect, useState } from 'react';
import { readChartTheme, type ChartTheme } from '../lib/theme';

/** Chart colours resolved from CSS variables; re-read when the OS colour scheme flips. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(readChartTheme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(readChartTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return theme;
}
