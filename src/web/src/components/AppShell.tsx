import { SparkEasterEgg } from '@spark/ui/easter-egg';
import { NavItem } from '@spark/ui/nav';
import { SparkContainer } from '@spark/ui/theme';
import { ThemeToggle } from '@spark/ui/theme-toggle';
import { SparkTopbar } from '@spark/ui/topbar';
import { SparkWidthToggle } from '@spark/ui/width-toggle';
import { Button } from '@spark/ui/button';
import { useQuery } from '@tanstack/react-query';
import { createLink, Link, useLocation, useNavigate } from '@tanstack/react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { fetchEnabledPluginIds, fetchMainSettings } from '@/api/customers';
import { can, clearSession, readSession } from '@/auth/session';
import { enabledModuleKeys } from '@/features/modules/catalog';
import { isActive, navigation } from '@/navigation';

const AppNavItem = createLink(NavItem);

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const session = readSession();
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  // The plugin list needs the `plugins` permission; without it, plugin entries stay hidden.
  const plugins = useQuery({
    queryKey: ['enabled-plugins'],
    queryFn: fetchEnabledPluginIds,
    enabled: can(session, 'plugins'),
  });
  const modules = enabledModuleKeys(settings.data?.enabled_modules);
  const items = navigation.filter(
    (item) =>
      (!item.permission || can(session, item.permission)) &&
      (item.plugin === undefined || (plugins.data ?? []).includes(item.plugin)) &&
      (item.module === undefined || modules.includes(item.module)),
  );

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
            <Link
              to="/profile"
              className="hidden text-sm text-on-topbar-muted hover:text-white hover:underline sm:inline"
            >
              {session?.user.name}
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="main-navigation"
              onClick={() => setMenuOpen((open) => !open)}
              className="text-white hover:bg-white/10 md:hidden"
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={logOut} className="text-white hover:bg-white/10">
              <LogOut />
            </Button>
          </>
        }
      />
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Below md the menu folds into the topbar button, so the page starts with its content. */}
        <nav
          id="main-navigation"
          aria-label="Main"
          className={`${menuOpen ? 'flex' : 'hidden'} w-full shrink-0 flex-col gap-0.5 border-b border-border bg-panel p-3 md:flex md:w-56 md:border-r md:border-b-0`}
        >
          {settings.data ? (
            <div className="mb-2 border-b border-border px-3 pb-3 font-heading text-base font-bold text-foreground">
              {settings.data.company_name}
            </div>
          ) : null}
          {items.map((item) => (
            <AppNavItem
              key={item.label}
              to={item.path}
              active={isActive(item, pathname)}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </AppNavItem>
          ))}
        </nav>
        <main className="min-w-0 flex-1 py-4 sm:py-6">
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
