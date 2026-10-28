'use client';

import { Moon, Sun } from 'lucide-react';

import { cn } from './cn';
import { THEME_STORAGE_KEY } from './theme';

type ThemeToggleProps = {
  className?: string;
  storageKey?: string;
};

// The icon is chosen by CSS (`dark:` variant), never by React state: the server
// cannot know the visitor's theme, so rendering it from state would either
// flash the wrong icon or break hydration.
export function ThemeToggle({
  className,
  storageKey = THEME_STORAGE_KEY,
}: ThemeToggleProps) {
  function toggle() {
    const root = document.documentElement;
    const systemDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    const current =
      root.getAttribute('data-theme') ?? (systemDark ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Private mode / storage disabled: the theme still applies for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        // Colors come from the surrounding text color, so the same button
        // works on the navy topbar and on a light header.
        'inline-grid size-9 cursor-pointer place-items-center rounded-md border border-current/20 bg-current/5 text-inherit transition-colors hover:bg-current/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Sun className="size-[19px] dark:hidden" aria-hidden />
      <Moon className="hidden size-[19px] dark:block" aria-hidden />
    </button>
  );
}
