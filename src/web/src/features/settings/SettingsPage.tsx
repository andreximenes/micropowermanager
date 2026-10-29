import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Link } from '@tanstack/react-router';

import { ApiKeySettings } from './ApiKeySettings';
import { CompanySettingsForm } from './CompanySettingsForm';
import { type SettingsTab } from './listSearch';
import { MapSettingsForm } from './MapSettingsForm';
import { PluginSettings } from './PluginSettings';

import { can, readSession } from '@/auth/session';

const tabLabels: Record<SettingsTab, string> = {
  company: 'Company',
  map: 'Map',
  plugins: 'Plugins',
  'api-keys': 'API keys',
};

// The plugin and API key endpoints each check their own permission.
const tabPermission: Partial<Record<SettingsTab, string>> = {
  plugins: 'plugins',
  'api-keys': 'settings.api-keys',
};

export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const session = readSession();
  const tabs = (Object.keys(tabLabels) as SettingsTab[]).filter((name) => {
    const permission = tabPermission[name];
    return permission === undefined || can(session, permission);
  });
  const current = tabs.includes(tab) ? tab : 'company';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Settings</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            Company-wide settings. Only admins can change them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link to="/settings/import">Import data</Link>
          </Button>
          {can(session, 'users') ? (
            <Button asChild variant="outline" className="h-10">
              <Link to="/settings/users">Users and roles</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {can(session, 'settings') ? (
        <>
          <nav
            aria-label="Settings sections"
            className="flex max-w-full gap-1 overflow-x-auto border-b border-border"
          >
            {tabs.map((name) => (
              <Link
                key={name}
                to="/settings"
                search={{ tab: name === 'company' ? undefined : name }}
                replace
                aria-current={current === name ? 'page' : undefined}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${current === name ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {tabLabels[name]}
              </Link>
            ))}
          </nav>
          {current === 'company' ? <CompanySettingsForm /> : null}
          {current === 'map' ? <MapSettingsForm /> : null}
          {current === 'plugins' ? <PluginSettings /> : null}
          {current === 'api-keys' ? <ApiKeySettings /> : null}
        </>
      ) : (
        <Banner tone="info">
          Your account cannot change company settings. Ask an owner or admin if something here needs
          to change.
        </Banner>
      )}
    </div>
  );
}
