import { ArrowLeft } from 'lucide-react';

import { cn } from './cn';

// Platform rule (ARCHITECTURE §5.2): every mini-app always offers a way back
// to the Hub. Path-based routing means the Hub is always at "/" of the host.
type BackToHubProps = {
  variant?: 'floating' | 'inline';
  className?: string;
  // Behind the gateway the Hub is always at "/" of the host; local dev can
  // point it at the Hub's own dev server instead.
  href?: string;
};

export function BackToHub({
  variant = 'floating',
  className,
  href = '/',
}: BackToHubProps) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'floating' && 'fixed bottom-4 left-4 z-50',
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      Spark Hub
    </a>
  );
}
