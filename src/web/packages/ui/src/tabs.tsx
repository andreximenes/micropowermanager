import { type ComponentProps } from 'react';

import { cn } from './cn';

// Segmented control: a few mutually exclusive views of the same data. For
// navigation between pages use NavItem instead.
export function Tabs({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex gap-1 rounded-md border border-border bg-panel p-1',
        className,
      )}
      {...props}
    />
  );
}

type TabProps = ComponentProps<'button'> & { active?: boolean };

export function Tab({ className, active, ...props }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        'cursor-pointer rounded-sm px-4 py-1.5 font-heading text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-panel-2 hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
