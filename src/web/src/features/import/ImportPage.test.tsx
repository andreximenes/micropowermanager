import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { describeFailedItem } from './runImport';

import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const jsonFile = (name: string, content: unknown) =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, {
    type: 'application/json',
  });

const outcome = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  message: 'Imported',
  imported_count: 2,
  added_count: 2,
  modified_count: 0,
  failed_count: 0,
  added: [],
  modified: [],
  failed: [],
  ...overrides,
});

function rowOf(label: string) {
  const row = screen.getByText(new RegExp(`· ${label}$`)).closest('li');
  if (!row) {
    throw new Error(`No row for ${label}`);
  }
  return within(row);
}

describe('ImportPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('imports every chosen file in order, waiting for the ones run in the background', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn();
    const sent: { kind: string; body: unknown }[] = [];
    let polls = 0;
    server.use(
      http.post('/api/import/:kind', async ({ params, request }) => {
        sent.push({ kind: String(params.kind), body: await request.json() });
        if (params.kind === 'clusters') {
          return HttpResponse.json(
            { data: { job_id: 'job-1', status: 'pending' } },
            { status: 202 },
          );
        }
        return HttpResponse.json({
          data: outcome({
            added_count: 1,
            modified_count: 1,
            failed_count: 1,
            failed: [{ name: 'Amina Okafor', errors: { phone: 'The phone is taken.' } }],
          }),
        });
      }),
      http.get('/api/import/status/:jobId', () => {
        polls += 1;
        return HttpResponse.json({
          data:
            polls === 1
              ? { status: 'processing', result: null, error: null }
              : { status: 'completed', result: outcome({ added_count: 60 }), error: null },
        });
      }),
    );
    const { user } = renderApp('/settings/import');

    await user.upload(
      await screen.findByLabelText('Customers file'),
      jsonFile('customers.json', [{ name: 'Amina' }]),
    );
    await user.upload(
      screen.getByLabelText('Locations file'),
      jsonFile('clusters.json', { data: [{ cluster_name: 'Jema’a' }] }),
    );
    expect(rowOf('Locations').getByText('clusters.json')).toBeInTheDocument();
    expect(rowOf('Locations').getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Import selected (2)' }));

    expect(await rowOf('Locations').findByText('Running in the background…')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await rowOf('Locations').findByText('Done · 60 added, 0 updated')).toBeInTheDocument();
    expect(
      await rowOf('Customers').findByText('Done · 1 added, 1 updated, 1 failed'),
    ).toBeInTheDocument();
    await user.click(rowOf('Customers').getByText('1 record not imported'));
    expect(rowOf('Customers').getByText('Amina Okafor: The phone is taken.')).toBeVisible();

    // Clusters come before customers, and an export's `data` wrapper is unwrapped.
    expect(sent).toEqual([
      { kind: 'clusters', body: { data: [{ cluster_name: 'Jema’a' }] } },
      { kind: 'customers', body: { data: [{ name: 'Amina' }] } },
    ]);
    expect(screen.getByRole('button', { name: 'Import selected (0)' })).toBeDisabled();
  });

  it('carries on after a refused file, a failed job and a file that is not JSON', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn();
    server.use(
      http.post('/api/import/clusters', () =>
        HttpResponse.json(
          {
            message: 'Each cluster must have a name.',
            errors: { 'data.0.cluster_name': ['Each cluster must have a name.'] },
          },
          { status: 422 },
        ),
      ),
      http.post('/api/import/devices', () =>
        HttpResponse.json({ data: { job_id: 'job-2', status: 'pending' } }, { status: 202 }),
      ),
      http.get('/api/import/status/:jobId', () =>
        HttpResponse.json({
          data: {
            status: 'failed',
            result: { success: false, errors: { transaction: 'Rolled back.' } },
            error: null,
          },
        }),
      ),
      http.post('/api/import/transactions', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/settings/import');

    await user.upload(
      await screen.findByLabelText('Settings file'),
      jsonFile('settings.json', 'not json'),
    );
    await user.upload(screen.getByLabelText('Locations file'), jsonFile('clusters.json', [{}]));
    await user.upload(screen.getByLabelText('Devices file'), jsonFile('devices.json', [{}]));
    await user.upload(screen.getByLabelText('Transactions file'), jsonFile('tx.json', [{}]));
    await user.click(screen.getByRole('button', { name: 'Import selected (4)' }));

    expect(await rowOf('Settings').findByRole('alert')).toHaveTextContent('This file is not JSON.');
    expect(await rowOf('Locations').findByRole('alert')).toHaveTextContent('The file was refused.');
    await user.click(rowOf('Locations').getByText('Why'));
    expect(rowOf('Locations').getByText('Each cluster must have a name.')).toBeVisible();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await rowOf('Devices').findByRole('alert')).toHaveTextContent('The import failed.');
    expect(rowOf('Devices').getByText('Rolled back.')).toBeInTheDocument();
    expect(await rowOf('Transactions').findByRole('alert')).toHaveTextContent('Server Error');
    // Failed files stay selected, ready to try again.
    expect(screen.getByRole('button', { name: 'Import selected (4)' })).toBeEnabled();
  });

  it('lists only what the role may import', async () => {
    signIn({ permissions: ['customers'] });
    renderApp('/settings/import');

    expect(await screen.findByLabelText('Customers file')).toBeInTheDocument();
    expect(screen.getByLabelText('Devices file')).toBeInTheDocument();
    expect(screen.queryByLabelText('Settings file')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Transactions file')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('says so when the role can import nothing', async () => {
    signIn({ permissions: ['tickets'] });
    renderApp('/settings/import');

    expect(await screen.findByText(/Your role can't import any data/)).toBeInTheDocument();
  });
});

describe('describeFailedItem', () => {
  it.each([
    [{ device_serial: 'SHS-1', error: 'Unknown type.' }, 'SHS-1: Unknown type.'],
    [{ email: 'a@b.c', errors: { roles: ['Unknown role.'] } }, 'a@b.c: Unknown role.'],
    [{}, 'Record 3: not imported'],
  ])('describes %o', (item, line) => {
    expect(describeFailedItem(item, 2)).toBe(line);
  });
});
