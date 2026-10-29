import { Banner } from '@spark/ui/banner';
import { Card } from '@spark/ui/card';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchCompanySettings, updateEnabledModules } from '@/api/settings';
import { Switch } from '@/components/Switch';
import { appModules, enabledModuleKeys, moduleKeys, type ModuleKey } from '@/features/modules/catalog';

export function ModuleSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['main-settings', 'full'], queryFn: fetchCompanySettings });

  const toggle = useMutation({
    mutationFn: (change: { key: ModuleKey; on: boolean; settingsId: number; modules: ModuleKey[] }) =>
      updateEnabledModules(change.settingsId, change.modules),
    // The menu lists a module only while it is on, and it reads the main settings.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['main-settings'] }),
  });

  if (settings.error) {
    return (
      <Banner tone="error" role="alert">
        Could not load modules: {settings.error.message}
      </Banner>
    );
  }
  if (!settings.data) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading modules…</p>;
  }

  const settingsId = settings.data.id;
  const enabled = enabledModuleKeys(settings.data.enabled_modules);

  function switchModule(key: ModuleKey, on: boolean) {
    const modules = on ? [...enabled, key] : enabled.filter((enabledKey) => enabledKey !== key);
    toggle.mutate({ key, on, settingsId, modules });
  }

  return (
    <Card className="bg-panel">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <h2 className="m-0 text-base font-bold">Modules</h2>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          {enabled.length} of {moduleKeys.length} on. Turning one on adds it to the menu, where its
          screen still has to be rebuilt.
        </p>
      </div>
      {toggle.isError ? (
        <div className="px-4 pt-4 sm:px-6">
          <Banner tone="error" role="alert">
            {appModules[toggle.variables.key].name} was not switched{' '}
            {toggle.variables.on ? 'on' : 'off'}: {toggle.error.message}
          </Banner>
        </div>
      ) : null}
      <ul aria-label="Modules" className="m-0 list-none divide-y divide-border p-0">
        {moduleKeys.map((key) => {
          const module = appModules[key];
          const on = enabled.includes(key);
          return (
            <li key={key} className="flex items-center gap-4 px-4 py-3.5 sm:px-6">
              <module.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">{module.name}</p>
                <p className="m-0 mt-0.5 text-sm text-muted-foreground">{module.description}</p>
              </div>
              <Switch
                label={module.name}
                checked={on}
                disabled={toggle.isPending}
                onToggle={() => switchModule(key, !on)}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
