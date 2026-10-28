'use client';

import { useEffect, useState } from 'react';

// Charting libraries (recharts, d3, canvas) need concrete color strings — they
// cannot consume `var(--panel)`. This reads the resolved token values and
// re-reads them whenever the theme changes, so a chart follows dark mode
// instead of freezing on whatever the palette was at first render.
//
// Pass a map of friendly name → custom property:
//   const c = useThemeTokens({ panel: '--panel', line: '--line' })
//
// The first render returns `fallback` (or empty strings), because the server
// has no computed styles — render the chart only after mount.
export function useThemeTokens<T extends Record<string, string>>(
  names: T,
  fallback?: Partial<Record<keyof T, string>>,
): Record<keyof T, string> {
  const [values, setValues] = useState<Record<keyof T, string>>(() => {
    const initial = {} as Record<keyof T, string>;
    for (const key of Object.keys(names) as (keyof T)[]) {
      initial[key] = fallback?.[key] ?? '';
    }
    return initial;
  });

  useEffect(() => {
    function read() {
      const styles = getComputedStyle(document.documentElement);
      const next = {} as Record<keyof T, string>;
      for (const key of Object.keys(names) as (keyof T)[]) {
        next[key] = styles.getPropertyValue(names[key] as string).trim();
      }
      setValues(next);
    }

    read();

    // Both theme signals: the explicit toggle stamps data-theme on <html>, and
    // with no explicit choice the OS preference decides.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', read);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', read);
    };
    // `names` is a literal at every call site; re-reading on identity changes
    // would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return values;
}
