import { type ComponentProps, type ReactNode } from 'react';

import { cn } from './cn';

type NavBarProps = ComponentProps<'header'> & {
  brand: ReactNode;
  actions?: ReactNode;
};

export function NavBar({
  className,
  brand,
  actions,
  children,
  ...props
}: NavBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center gap-6 border-b border-border bg-panel px-4 md:px-6',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 font-heading font-semibold text-foreground">
        {brand}
      </div>
      <nav className="flex flex-1 items-center gap-1">{children}</nav>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type NavItemProps = ComponentProps<'a'> & { active?: boolean };

export function NavItem({ className, active, ...props }: NavItemProps) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-sage text-sage-ink'
          : 'text-muted-foreground hover:bg-panel-2 hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
