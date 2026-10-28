import { type ReactNode } from 'react';

import { cn } from './cn';
import { SparkLogo } from './spark-logo';
import { SparkContainer } from './theme';

type SparkTopbarProps = {
  // "navy" — the full brand chrome: navy bar, white wordmark. The default for
  //   mini-apps, where the bar is the only Spark signal on the page.
  // "surface" — a light header (panel white in light, dark panel in dark) with
  //   the green wordmark. What the Hub uses: it already reads as Spark, and a
  //   navy bar competes with the navy app tiles below it.
  variant?: 'navy' | 'surface';
  // The app's own name, shown next to the wordmark. Leave it out on the Hub.
  appName?: ReactNode;
  // One line under the name, e.g. what the app is for.
  subtitle?: ReactNode;
  // Where the wordmark links. Behind the gateway the Hub is always "/".
  homeHref?: string;
  // Right-hand slot — put <ThemeToggle /> and the user menu here.
  actions?: ReactNode;
  // Center slot, typically navigation.
  children?: ReactNode;
  className?: string;
};

// The Spark chrome: wordmark, app name, and the green→teal accent hairline
// that ends every Spark header.
export function SparkTopbar({
  variant = 'navy',
  appName,
  subtitle,
  homeHref = '/',
  actions,
  children,
  className,
}: SparkTopbarProps) {
  const navy = variant === 'navy';

  return (
    <header
      className={cn(
        'theme-surface',
        // The navy bar stays navy in BOTH themes, which is why everything on
        // it is white in both — do not swap it for a themed surface.
        navy ? 'bg-topbar text-white' : 'bg-panel text-foreground',
        className,
      )}
    >
      <SparkContainer
        className={cn('flex items-center gap-4', navy ? 'py-4' : 'py-3')}
      >
        <a
          href={homeHref}
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SparkLogo
            className={cn(
              navy ? 'h-[26px] fill-white' : 'h-5 fill-green-bright',
            )}
          />
        </a>

        {appName ? (
          <div className="min-w-0">
            <div className="truncate font-heading text-base leading-tight">
              {appName}
            </div>
            {subtitle ? (
              <div
                className={cn(
                  'truncate text-xs',
                  navy ? 'text-on-topbar-muted' : 'text-muted-foreground',
                )}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </SparkContainer>

      {/* The navy bar closes with the brand accent line. The light header
          closes with a plain divider — the gradient read as a stray artifact
          under it (André, 2026-08-03). */}
      {navy ? (
        <div className="mx-auto h-1 w-full max-w-maxw bg-gradient-to-r from-green-bright to-teal" />
      ) : (
        <div className="h-px w-full bg-border" />
      )}
    </header>
  );
}
