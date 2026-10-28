'use client';

import { useEffect } from 'react';

import { WIDTH_STORAGE_KEY } from './theme';

type SparkWidthToggleProps = {
  storageKey?: string;
};

// Pressing "w" flips every --maxw container to the full window width, and the
// choice sticks. This is what makes dense views (tables, logs) usable on wide
// monitors without committing the whole app to a wide layout.
//
// Renders nothing: it only installs the key listener. The saved value is
// applied before first paint by <SparkThemeScript />.
export function SparkWidthToggle({
  storageKey = WIDTH_STORAGE_KEY,
}: SparkWidthToggleProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'w' && event.key !== 'W') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Never steal the key while someone is typing.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      )
        return;

      const root = document.documentElement;
      const wide = root.getAttribute('data-width') !== 'wide';
      if (wide) root.setAttribute('data-width', 'wide');
      else root.removeAttribute('data-width');
      try {
        localStorage.setItem(storageKey, wide ? 'wide' : 'normal');
      } catch {
        // Storage disabled: the width still applies for this page.
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [storageKey]);

  return null;
}
