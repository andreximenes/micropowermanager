import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { StatusPill } from '@spark/ui/status-pill';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FileUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { describeFailedItem, ImportFailure, runImport } from './runImport';

import { importKinds, importPermission, type ImportKind, type ImportOutcome } from '@/api/imports';
import { can, readSession } from '@/auth/session';
import { plural } from '@/lib/format';

const kindCopy: Record<ImportKind, { label: string; description: string }> = {
  settings: { label: 'Settings', description: 'Company name, currency, country and main options' },
  'user-permissions': { label: 'Users', description: 'Users with their roles and permissions' },
  clusters: { label: 'Locations', description: 'Clusters with their sites and villages' },
  devices: { label: 'Devices', description: 'Meters, solar home systems and e-bikes' },
  customers: { label: 'Customers', description: 'Customers with addresses and contact details' },
  transactions: { label: 'Transactions', description: 'Payments recorded against devices' },
  appliances: { label: 'Appliances', description: 'Appliances with their types and prices' },
  'appliance-people': {
    label: 'Sold appliances',
    description: 'Appliances sold to customers, with their payment plans',
  },
};

type Progress =
  | { status: 'ready' }
  | { status: 'importing' }
  | { status: 'queued' }
  | { status: 'done'; outcome: ImportOutcome }
  | { status: 'failed'; message: string; details: string[] };

type Row = { file: File | null; selected: boolean; progress: Progress };

const emptyRow: Row = { file: null, selected: false, progress: { status: 'ready' } };

function ProgressPill({ row }: { row: Row }) {
  const { progress } = row;
  if (progress.status === 'importing') {
    return <StatusPill status="info">Importing…</StatusPill>;
  }
  if (progress.status === 'queued') {
    return <StatusPill status="info">Running in the background…</StatusPill>;
  }
  if (progress.status === 'failed') {
    return <StatusPill status="error">Failed</StatusPill>;
  }
  if (progress.status === 'done') {
    const { added_count: added, modified_count: modified, failed_count: failed } = progress.outcome;
    const summary = [
      `${added} added`,
      `${modified} updated`,
      ...(failed ? [`${failed} failed`] : []),
    ];
    return (
      <StatusPill status={failed ? 'warning' : 'success'}>Done · {summary.join(', ')}</StatusPill>
    );
  }
  return row.file ? <StatusPill status="neutral">Ready</StatusPill> : null;
}

function Problems({ progress }: { progress: Progress }) {
  const lines =
    progress.status === 'failed'
      ? progress.details
      : progress.status === 'done'
        ? progress.outcome.failed.map(describeFailedItem)
        : [];
  return (
    <>
      {progress.status === 'failed' ? (
        <p role="alert" className="m-0 text-sm text-red">
          {progress.message}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {progress.status === 'done' ? `${plural(lines.length, 'record')} not imported` : 'Why'}
          </summary>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5 text-muted-foreground">
            {lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

export function ImportPage() {
  const queryClient = useQueryClient();
  const session = readSession();
  const kinds = importKinds.filter((kind) => can(session, importPermission[kind]));
  const [rows, setRows] = useState<Partial<Record<ImportKind, Row>>>({});
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController>(null);

  // Leaving the page stops waiting for queued jobs; they keep running on the server.
  useEffect(() => () => abort.current?.abort(), []);

  const rowOf = (kind: ImportKind) => rows[kind] ?? emptyRow;
  const update = (kind: ImportKind, changes: Partial<Row>) =>
    setRows((current) => ({ ...current, [kind]: { ...(current[kind] ?? emptyRow), ...changes } }));
  const selected = kinds.filter((kind) => rowOf(kind).selected && rowOf(kind).file);

  async function importSelected() {
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    // One after another, in the listed order, so each file can link to what the earlier ones made.
    for (const kind of selected) {
      const file = rowOf(kind).file;
      if (!file) {
        continue;
      }
      update(kind, { progress: { status: 'importing' } });
      try {
        const outcome = await runImport(kind, file, {
          signal: controller.signal,
          onQueued: () => update(kind, { progress: { status: 'queued' } }),
        });
        update(kind, { selected: false, progress: { status: 'done', outcome } });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        update(kind, {
          progress: {
            status: 'failed',
            message: error instanceof Error ? error.message : 'The import failed.',
            details: error instanceof ImportFailure ? error.details : [],
          },
        });
      }
    }
    setRunning(false);
    await queryClient.invalidateQueries();
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/settings" className="hover:underline">
          Settings
        </Link>{' '}
        / Import data
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">Import data</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            Bring in records exported from another MicroPowerManager. Files are imported in this
            order, so links between them work.
          </p>
        </div>
        <Button disabled={running || selected.length === 0} onClick={() => void importSelected()}>
          {running ? 'Importing…' : `Import selected (${selected.length})`}
        </Button>
      </div>

      {kinds.length === 0 ? (
        <Banner tone="info">Your role can't import any data. Ask an administrator.</Banner>
      ) : (
        <Card className="bg-panel">
          <ul aria-label="Files to import" className="m-0 list-none divide-y divide-border p-0">
            {kinds.map((kind, index) => {
              const row = rowOf(kind);
              const { label, description } = kindCopy[kind];
              return (
                <li
                  key={kind}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4 sm:px-5"
                >
                  <input
                    type="checkbox"
                    aria-label={`Import ${label.toLowerCase()}`}
                    checked={row.selected}
                    disabled={!row.file || running}
                    onChange={(event) => update(kind, { selected: event.target.checked })}
                    className="mt-1 size-4"
                  />
                  <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                    <strong className="text-sm">
                      {index + 1} · {label}
                    </strong>
                    <span className="text-sm text-muted-foreground">{description}</span>
                  </div>
                  <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium ${running ? 'opacity-50' : 'cursor-pointer hover:bg-panel-2'}`}
                      >
                        <FileUp className="size-4" aria-hidden="true" />
                        {row.file ? 'Replace file' : 'Choose file'}
                        <input
                          type="file"
                          accept=".json,application/json"
                          aria-label={`${label} file`}
                          disabled={running}
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              update(kind, {
                                file,
                                selected: true,
                                progress: { status: 'ready' },
                              });
                            }
                            // Lets the same file be chosen again after a failed attempt.
                            event.target.value = '';
                          }}
                        />
                      </label>
                      {row.file ? (
                        <span className="min-w-0 truncate text-sm">{row.file.name}</span>
                      ) : null}
                    </div>
                    <Problems progress={row.progress} />
                  </div>
                  <div className="flex min-h-6 flex-[0_1_auto] items-center" aria-live="polite">
                    <ProgressPill row={row} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="m-0 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
            Use the .json files MicroPowerManager exports. Records that fail are skipped; the rest
            are imported. Files with 50 records or more are imported in the background.
          </p>
        </Card>
      )}
    </div>
  );
}
