import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  audienceLabels,
  checkSparkShsCredentials,
  deleteKitTypeRule,
  fetchKitTypeRules,
  fetchSparkShsCredentials,
  fetchSyncSettings,
  saveSyncSettings,
  startSync,
  waitForSync,
  type KitTypeRule,
  type SparkShsCredentials,
  type SyncSettings,
} from '@/api/sparkShs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { selectClass } from '@/components/form';
import { EmptyState, SectionCard } from '@/features/customer/sections';
import { formatDateTime, plural } from '@/lib/format';

import { ConnectionResult } from './ConnectionResult';
import { CredentialsSheet, KitTypeRuleSheet } from './SparkShsSheets';

const credentialsKey = ['spark-shs', 'credentials'];
const syncKey = ['spark-shs', 'sync'];
const rulesKey = ['spark-shs', 'rules'];

const intervalOptions = [1, 6, 12, 24, 48, 168];

function intervalLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 24) {
    return hours === 24 ? 'day' : `${hours / 24} days`;
  }
  return hours === 1 ? 'hour' : `${hours} hours`;
}

export function SparkShsPage({ syncPollMs }: { syncPollMs?: number }) {
  const [editing, setEditing] = useState(false);
  const credentials = useQuery({ queryKey: credentialsKey, queryFn: fetchSparkShsCredentials });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-bold">Spark SHS</h1>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          Connection to the Spark device cloud: tokens, unlocks and kit sync
        </p>
      </div>

      {credentials.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading the connection…</p>
      ) : null}
      {credentials.isError ? (
        <Banner tone="error" role="alert">
          Could not load the Spark SHS settings: {credentials.error.message}
        </Banner>
      ) : null}

      {credentials.data ? (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            <CredentialsCard credentials={credentials.data} onEdit={() => setEditing(true)} />
          </div>
          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-5">
            <KitSyncCard pollMs={syncPollMs} />
            <KitTypeRulesCard />
          </div>
        </div>
      ) : null}

      {editing && credentials.data ? (
        <CredentialsSheet credentials={credentials.data} onClose={() => setEditing(false)} />
      ) : null}
    </div>
  );
}

function CredentialsCard({
  credentials,
  onEdit,
}: {
  credentials: SparkShsCredentials;
  onEdit: () => void;
}) {
  const configured = Boolean(credentials.client_id) && credentials.has_client_secret;
  const check = useMutation({
    mutationFn: () =>
      checkSparkShsCredentials({
        client_id: credentials.client_id ?? '',
        // Blank: the server tests with the secret it stores.
        client_secret: '',
        audience: credentials.audience,
        auth_url: credentials.auth_url,
        api_url: credentials.api_url,
      }),
  });
  const rows: [string, string][] = [
    ['Client ID', credentials.client_id || 'Not set'],
    ['Client secret', credentials.has_client_secret ? 'Stored, encrypted' : 'Not set'],
    ['Environment', audienceLabels[credentials.audience]],
    ['Auth URL', credentials.auth_url],
    ['API URL', credentials.api_url],
  ];

  return (
    <SectionCard
      title="Credentials"
      action={
        <StatusPill status={configured ? 'success' : 'warning'}>
          {configured ? 'Set up' : 'Not set up'}
        </StatusPill>
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="m-0 break-all">{value}</dd>
            </div>
          ))}
        </dl>
        {credentials.updated_at ? (
          <p className="m-0 text-xs text-muted-foreground">
            Saved {formatDateTime(credentials.updated_at)}
          </p>
        ) : null}
        <ConnectionResult valid={check.data} error={check.error} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!configured || check.isPending}
            onClick={() => check.mutate()}
          >
            {check.isPending ? 'Testing…' : 'Test connection'}
          </Button>
          <Button onClick={onEdit}>{configured ? 'Edit credentials' : 'Set up credentials'}</Button>
        </div>
      </div>
    </SectionCard>
  );
}

function syncPill(settings: SyncSettings): {
  status: 'success' | 'warning' | 'error';
  label: string;
} {
  const result = settings.last_sync_result;
  if (settings.last_sync_status === 'failed' || result?.error) {
    return { status: 'error', label: 'Failed' };
  }
  if (result && (result.unmatchedKitTypes.length > 0 || result.conflicts.length > 0)) {
    return { status: 'warning', label: 'Finished with warnings' };
  }
  return { status: 'success', label: 'Finished' };
}

function KitSyncCard({ pollMs }: { pollMs?: number }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: syncKey, queryFn: fetchSyncSettings });
  const [stillRunning, setStillRunning] = useState(false);

  const saveSettings = useMutation({
    mutationFn: saveSyncSettings,
    // The switch moves at once; a refusal puts it back.
    onMutate: (next) => {
      const previous = queryClient.getQueryData<SyncSettings>(syncKey);
      if (previous) {
        queryClient.setQueryData(syncKey, { ...previous, ...next });
      }
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(syncKey, context.previous);
      }
    },
    onSuccess: (saved) => queryClient.setQueryData(syncKey, saved),
  });

  const sync = useMutation({
    mutationFn: async (previousSyncAt: string | null) => {
      setStillRunning(false);
      await startSync();
      return waitForSync(previousSyncAt, pollMs === undefined ? {} : { intervalMs: pollMs });
    },
    onSuccess: async (finished) => {
      if (!finished) {
        setStillRunning(true);
        return;
      }
      queryClient.setQueryData(syncKey, finished);
      await queryClient.invalidateQueries({ queryKey: ['solar-home-systems'] });
    },
  });

  if (settings.isPending) {
    return (
      <SectionCard title="Kit sync">
        <EmptyState>Loading kit sync…</EmptyState>
      </SectionCard>
    );
  }
  if (settings.isError) {
    return (
      <SectionCard title="Kit sync">
        <div className="p-4">
          <Banner tone="error" role="alert">
            Could not load kit sync: {settings.error.message}
          </Banner>
        </div>
      </SectionCard>
    );
  }

  const current = settings.data;
  const result = current.last_sync_result;
  const intervals = intervalOptions.includes(current.interval_hours)
    ? intervalOptions
    : [...intervalOptions, current.interval_hours].sort((a, b) => a - b);
  const pill = syncPill(current);

  return (
    <SectionCard
      title="Kit sync"
      action={
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Brings new kits from the Spark cloud into Solar home systems
        </span>
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              role="switch"
              checked={current.is_enabled}
              disabled={saveSettings.isPending}
              onChange={(event) =>
                saveSettings.mutate({
                  is_enabled: event.target.checked,
                  interval_hours: current.interval_hours,
                })
              }
              className="size-4 accent-primary"
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Run every
            <select
              className={selectClass}
              value={current.interval_hours}
              disabled={saveSettings.isPending}
              onChange={(event) =>
                saveSettings.mutate({
                  is_enabled: current.is_enabled,
                  interval_hours: Number(event.target.value),
                })
              }
            >
              {intervals.map((hours) => (
                <option key={hours} value={hours}>
                  {intervalLabel(hours)}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            className="sm:ml-auto"
            disabled={!current.is_enabled || sync.isPending}
            title={current.is_enabled ? undefined : 'Enable kit sync first'}
            onClick={() => sync.mutate(current.last_sync_at)}
          >
            {sync.isPending ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
        {saveSettings.isError ? (
          <Banner tone="error" role="alert">
            The setting was not saved: {saveSettings.error.message}
          </Banner>
        ) : null}
        {sync.isPending ? (
          <p role="status" className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Syncing with the Spark cloud. This can take a few minutes; you can keep working.
          </p>
        ) : null}
        {sync.isError ? (
          <Banner tone="error" role="alert">
            The sync did not start: {sync.error.message}
          </Banner>
        ) : null}
        {stillRunning ? (
          <Banner tone="info" role="status">
            The sync is still running in the background. Its result appears here when it ends.
          </Banner>
        ) : null}

        {current.last_sync_at ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Last sync · {formatDateTime(current.last_sync_at)}
              </span>
              <StatusPill status={pill.status}>{pill.label}</StatusPill>
            </div>
            {result?.error ? (
              <Banner tone="error" role="alert">
                {result.error}
              </Banner>
            ) : null}
            {result && !result.error ? (
              <>
                <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ['created', result.created],
                      ['already here', result.existing],
                      [
                        'unmatched kit types',
                        result.unmatchedKitTypes.reduce((sum, [, count]) => sum + count, 0),
                      ],
                      [
                        result.conflicts.length === 1 ? 'conflict' : 'conflicts',
                        result.conflicts.length,
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-col-reverse rounded-lg bg-panel-2 px-3 py-2"
                    >
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="m-0 text-xl font-bold">{value.toLocaleString('en')}</dd>
                    </div>
                  ))}
                </dl>
                {result.unmatchedKitTypes.length > 0 ? (
                  <p className="m-0 text-sm">
                    Kit types without a rule:{' '}
                    {result.unmatchedKitTypes.map(([kitType, count], index) => (
                      <span key={kitType}>
                        {index > 0 ? ', ' : ''}
                        <code className="font-mono">{kitType}</code> ({plural(count, 'kit')})
                      </span>
                    ))}
                    . Add a rule below and sync again.
                  </p>
                ) : null}
                {result.conflicts.length > 0 ? (
                  <p className="m-0 text-sm">
                    Already registered here under another record, so not imported:{' '}
                    <span className="font-mono">{result.conflicts.join(', ')}</span>.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <p className="m-0 border-t border-border pt-4 text-sm text-muted-foreground">
            No sync has run yet.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function KitTypeRulesCard() {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: rulesKey, queryFn: fetchKitTypeRules });
  const [panel, setPanel] = useState<
    { kind: 'edit'; rule?: KitTypeRule } | { kind: 'delete'; rule: KitTypeRule } | null
  >(null);

  return (
    <SectionCard
      title="Kit type rules"
      action={<Button onClick={() => setPanel({ kind: 'edit' })}>Add rule</Button>}
    >
      {rules.isPending ? <EmptyState>Loading rules…</EmptyState> : null}
      {rules.isError ? (
        <div className="p-4">
          <Banner tone="error" role="alert">
            Could not load the rules: {rules.error.message}
          </Banner>
        </div>
      ) : null}
      {rules.data?.length === 0 ? (
        <EmptyState>No rules yet. Without one, synced kits get no product.</EmptyState>
      ) : null}
      {rules.data && rules.data.length > 0 ? (
        <Table aria-label="Kit type rules">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 sm:pl-6">Kit type pattern</TableHead>
              <TableHead>Becomes product</TableHead>
              <TableHead className="pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.data.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="pl-4 font-mono break-words sm:pl-6">{rule.pattern}</TableCell>
                <TableCell>
                  {rule.appliance?.name ?? (
                    <span className="text-muted-foreground">No product yet</span>
                  )}
                </TableCell>
                <TableCell className="py-1.5 pr-4 sm:pr-6">
                  <span className="flex justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit rule ${rule.pattern}`}
                      onClick={() => setPanel({ kind: 'edit', rule })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-red"
                      aria-label={`Delete rule ${rule.pattern}`}
                      onClick={() => setPanel({ kind: 'delete', rule })}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {panel?.kind === 'edit' ? (
        <KitTypeRuleSheet rule={panel.rule} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'delete' ? (
        <ConfirmDialog
          title={`Delete the rule ${panel.rule.pattern}?`}
          description="Kits already synced keep their product. New kits of this type get no product until another rule matches."
          confirmLabel="Delete rule"
          pendingLabel="Deleting…"
          failureLabel="The rule was not deleted"
          onConfirm={() => deleteKitTypeRule(panel.rule.id)}
          onDone={() => queryClient.invalidateQueries({ queryKey: rulesKey })}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </SectionCard>
  );
}
