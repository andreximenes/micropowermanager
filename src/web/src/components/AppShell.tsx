import { SparkEasterEgg } from '@spark/ui/easter-egg';
import { NavItem } from '@spark/ui/nav';
import { SparkContainer } from '@spark/ui/theme';
import { ThemeToggle } from '@spark/ui/theme-toggle';
import { SparkTopbar } from '@spark/ui/topbar';
import { SparkWidthToggle } from '@spark/ui/width-toggle';
import { Button } from '@spark/ui/button';
import { useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { type ReactNode } from 'react';

import { can, clearSession, readSession } from '@/auth/session';
import { navHref, navigation } from '@/legacy';

type AppShellProps = { children: ReactNode; activeLabel?: string };

export function AppShell({ children, activeLabel }: AppShellProps) {
  const navigate = useNavigate();
  const session = readSession();
  const items = navigation.filter((item) => !item.permission || can(session, item.permission));

  function logOut() {
    clearSession();
    void navigate({ to: '/login' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SparkTopbar
        appName="Spark CRM"
        actions={
          <>
            <span className="hidden text-sm text-on-topbar-muted sm:inline">{session?.user.name}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={logOut} className="text-white hover:bg-white/10">
              <LogOut />
            </Button>
          </>
        }
      />
      <div className="flex flex-1 flex-wrap">
        <nav aria-label="Main" className="flex w-full flex-col gap-0.5 border-r border-border bg-panel p-3 md:w-56">
          {items.map((item) => (
            <NavItem key={item.label} href={navHref(item)} active={item.label === activeLabel}>
              {item.label}
            </NavItem>
          ))}
        </nav>
        <main className="min-w-0 flex-[999_1_560px] py-6">
          <SparkContainer>{children}</SparkContainer>
        </main>
      </div>
      <footer className="px-6 py-4 text-right text-xs text-muted-foreground">
        Spark CRM · Powered by{' '}
        <a href="https://micropowermanager.io" target="_blank" rel="noreferrer" className="underline">
          MicroPowerManager
        </a>
      </footer>
      <SparkWidthToggle />
      <SparkEasterEgg egg="spark-burst" />
    </div>
  );
}
