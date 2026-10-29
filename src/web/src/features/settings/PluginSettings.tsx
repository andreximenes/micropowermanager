import { Banner } from '@spark/ui/banner';
import { Card } from '@spark/ui/card';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchEnabledPluginIds } from '@/api/customers';
import {
  fetchCompanySettings,
  fetchMpmPlugins,
  pluginFitsUsageType,
  setPluginEnabled,
  type MpmPlugin,
} from '@/api/settings';
import { SearchBox } from '@/components/SearchBox';
import { Switch } from '@/components/Switch';

export function PluginSettings() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const plugins = useQuery({ queryKey: ['mpm-plugins'], queryFn: fetchMpmPlugins });
  const enabled = useQuery({ queryKey: ['enabled-plugins'], queryFn: fetchEnabledPluginIds });
  const settings = useQuery({ queryKey: ['main-settings', 'full'], queryFn: fetchCompanySettings });

  const toggle = useMutation({
    mutationFn: ({ plugin, on }: { plugin: MpmPlugin; on: boolean }) =>
      setPluginEnabled(plugin, on),
    // The menu shows a plugin's screens only while it is on.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['enabled-plugins'] }),
  });

  const loadError = plugins.error ?? enabled.error ?? settings.error;
  if (loadError) {
    return (
      <Banner tone="error" role="alert">
        Could not load plugins: {loadError.message}
      </Banner>
    );
  }
  if (!plugins.data || !enabled.data || !settings.data) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading plugins…</p>;
  }

  const enabledIds = enabled.data;
  const usageType = settings.data.usage_type;
  const offered = plugins.data.filter(
    (plugin) => pluginFitsUsageType(plugin, usageType) || enabledIds.includes(plugin.id),
  );
  const wanted = term.trim().toLowerCase();
  const shown = offered.filter((plugin) =>
    `${plugin.name} ${plugin.description ?? ''}`.toLowerCase().includes(wanted),
  );
  const onCount = offered.filter((plugin) => enabledIds.includes(plugin.id)).length;
  const pendingId = toggle.isPending ? toggle.variables.plugin.id : null;

  return (
    <Card className="bg-panel">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="mr-auto">
          <h2 className="m-0 text-base font-bold">Plugins</h2>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            {onCount} of {offered.length} on. Turning one on adds its menu item and settings.
          </p>
        </div>
        <SearchBox
          term=""
          onSearch={setTerm}
          label="Search plugins"
          placeholder="Search plugins"
          className="min-w-0 flex-[0_1_340px]"
        />
      </div>
      {toggle.isError ? (
        <div className="px-4 pt-4 sm:px-6">
          <Banner tone="error" role="alert">
            {toggle.variables.plugin.name} was not switched {toggle.variables.on ? 'on' : 'off'}:{' '}
            {toggle.error.message}
          </Banner>
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          No plugin matches this search.
        </p>
      ) : (
        <ul aria-label="Plugins" className="m-0 list-none divide-y divide-border p-0">
          {shown.map((plugin) => {
            const on = enabledIds.includes(plugin.id);
            return (
              <li key={plugin.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold">{plugin.name}</p>
                  {plugin.description ? (
                    <p className="m-0 mt-0.5 text-sm text-muted-foreground">{plugin.description}</p>
                  ) : null}
                </div>
                <Switch
                  label={plugin.name}
                  checked={on}
                  disabled={pendingId !== null}
                  onToggle={() => toggle.mutate({ plugin, on: !on })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
