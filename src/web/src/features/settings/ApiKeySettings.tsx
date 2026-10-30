import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { useState } from 'react';

import { createApiKey, deleteApiKey, fetchApiKeys, type ApiKey } from '@/api/settings';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CopyButton } from '@/components/CopyButton';
import { formatDate, formatDateTime } from '@/lib/format';

type NewKey = { name: string | null; token: string };

const keyName = (apiKey: { name: string | null }) => apiKey.name ?? 'Unnamed key';

function NewKeyNotice({ created, onDone }: { created: NewKey; onDone: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-green bg-green/10 p-4 text-sm"
    >
      <p className="m-0 flex items-start gap-2">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />
        <span>
          <strong>Key “{keyName(created)}” created. Copy it now.</strong>
          <br />
          This is the only time it is shown. If you lose it, delete it and generate a new one.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          readOnly
          aria-label="New API key"
          value={created.token}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-[1_1_260px] bg-panel tabular-nums"
        />
        <CopyButton text={created.token} />
        <Button variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function KeyStatus({ apiKey }: { apiKey: ApiKey }) {
  return apiKey.active ? (
    <StatusPill status="success">Active</StatusPill>
  ) : (
    <StatusPill status="neutral">Inactive</StatusPill>
  );
}

export function ApiKeySettings() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [created, setCreated] = useState<NewKey | null>(null);
  const [deleting, setDeleting] = useState<ApiKey | null>(null);
  const apiKeys = useQuery({ queryKey: ['api-keys'], queryFn: fetchApiKeys });

  const generate = useMutation({
    mutationFn: (keyName: string | null) => createApiKey(keyName),
    onSuccess: async ({ token }, keyName) => {
      setCreated({ name: keyName, token });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  return (
    <Card className="bg-panel">
      <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="mr-auto min-w-0 flex-[1_1_260px]">
          <h2 className="m-0 text-base font-bold">API keys</h2>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            For other systems that read or send data to Spark CRM, like the BI warehouse.
          </p>
        </div>
        <form
          className="flex min-w-0 flex-[1_1_340px] items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            generate.mutate(name.trim() || null);
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium text-label">
            Name
            <Input
              value={name}
              maxLength={255}
              placeholder="What uses this key"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Button type="submit" className="h-10" disabled={generate.isPending}>
            {generate.isPending ? 'Generating…' : 'Generate key'}
          </Button>
        </form>
      </div>

      {generate.isError || created ? (
        <div className="px-4 pt-4 sm:px-6">
          {generate.isError ? (
            <Banner tone="error" role="alert">
              The key was not generated: {generate.error.message}
            </Banner>
          ) : null}
          {created ? <NewKeyNotice created={created} onDone={() => setCreated(null)} /> : null}
        </div>
      ) : null}

      {apiKeys.isPending ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading API keys…</p>
      ) : null}
      {apiKeys.isError ? (
        <div className="p-4 sm:px-6">
          <Banner tone="error" role="alert">
            Could not load API keys: {apiKeys.error.message}
          </Banner>
        </div>
      ) : null}
      {apiKeys.data?.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          No API keys yet. Generate one when another system needs access.
        </p>
      ) : null}

      {apiKeys.data && apiKeys.data.length > 0 ? (
        <>
          <Table aria-label="API keys" className="mt-2 hidden md:table">
            <TableHeader>
              <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                <TableHead className="pl-6 font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold">Last used</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.data.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="pl-6 font-semibold">{keyName(apiKey)}</TableCell>
                  <TableCell>{formatDate(apiKey.created_at)}</TableCell>
                  <TableCell>
                    {apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : 'Never'}
                  </TableCell>
                  <TableCell>
                    <KeyStatus apiKey={apiKey} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red"
                      aria-label={`Delete ${keyName(apiKey)}`}
                      onClick={() => setDeleting(apiKey)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ul aria-label="API keys" className="m-0 flex list-none flex-col gap-2 p-3 md:hidden">
            {apiKeys.data.map((apiKey) => (
              <li
                key={apiKey.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <strong className="truncate">{keyName(apiKey)}</strong>
                    <KeyStatus apiKey={apiKey} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Created {formatDate(apiKey.created_at)} · Last used{' '}
                    {apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : 'never'}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red"
                  aria-label={`Delete ${keyName(apiKey)}`}
                  onClick={() => setDeleting(apiKey)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`Delete ${keyName(deleting)}?`}
          description="Systems using this key stop getting access at once. This cannot be undone."
          confirmLabel="Delete key"
          pendingLabel="Deleting…"
          failureLabel="The key was not deleted"
          onConfirm={() => deleteApiKey(deleting.id)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </Card>
  );
}
