import { cn } from './cn';

// Platform theming (ARCHITECTURE §7.6). Every Spark surface ships a dark mode:
// the OS preference decides by default, an explicit toggle always wins, and the
// choice survives a reload.
//
// One storage key for the WHOLE platform, not one per app. Path-based routing
// puts the Hub and every mini-app on the same origin, so a shared key means a
// user who picks dark in the Hub stays in dark when they open an app. Only pass
// a different key if an app must deliberately opt out of that.
export const THEME_STORAGE_KEY = 'spark-theme';
export const WIDTH_STORAGE_KEY = 'spark-width';

// Vite build: there is no next/script, so the pre-paint script that applies a
// saved theme and width lives inline in src/web/index.html, reading the two keys
// above.

// Content container. Everything centered in a Spark app runs off --maxw so the
// topbar, the accent bar and the page body widen together when "w" is pressed.
export function SparkContainer({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-maxw px-4 sm:px-6', className)}
      {...props}
    />
  );
}
