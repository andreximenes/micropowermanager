import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

function page<T>(rows: T[], overrides: Record<string, unknown> = {}) {
  return {
    data: rows,
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: rows.length,
    from: rows.length ? 1 : null,
    to: rows.length || null,
    ...overrides,
  };
}

const monthly = {
  id: 3,
  name: 'Kafanchan',
  type: 'monthly',
  date: '2026-09-01---2026-09-30',
  path: 'reports/4/x.xlsx*4',
  created_at: '2026-10-01T03:00:00.000000Z',
};

function reportHandlers() {
  const requests: URL[] = [];
  server.use(
    http.get('/api/reports', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      if (url.searchParams.get('type') === 'weekly') {
        return HttpResponse.json(page([]));
      }
      return HttpResponse.json(page([monthly], { last_page: 2, total: 16, from: 1, to: 15 }));
    }),
    http.get('/api/tickets/reports', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(
        page([
          { id: 9, date: '2026-10-01---2026-10-31', path: 'p', created_at: '2026-11-01T03:30:00Z' },
        ]),
      );
    }),
  );
  return requests;
}

describe('ReportList', () => {
  beforeEach(() => {
    signIn();
  });

  it('lists monthly reports by period and village', async () => {
    const requests = reportHandlers();
    renderApp('/reports');

    const table = await screen.findByRole('table', { name: 'Monthly reports' });
    const row = within(table).getByRole('row', { name: /September 2026/ });
    expect(row).toHaveTextContent('Kafanchan · Monthly revenue');
    expect(row).toHaveTextContent('01 Oct 2026');
    expect(requests[0]?.searchParams.get('type')).toBe('monthly');
    expect(screen.getByText(/^Next report: .* at 03:00 UTC$/)).toBeInTheDocument();
  });

  it('downloads a report as the server names it', async () => {
    reportHandlers();
    server.use(
      http.get('/api/reports/download/3', () =>
        HttpResponse.text('xlsx', {
          headers: { 'Content-Disposition': 'attachment; filename="monthly-kafanchan.xlsx"' },
        }),
      ),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    const { user } = renderApp('/reports');

    const table = await screen.findByRole('table', { name: 'Monthly reports' });
    await user.click(
      within(table).getByRole('button', {
        name: 'Download September 2026 Kafanchan · Monthly revenue report',
      }),
    );

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('monthly-kafanchan.xlsx');
  });

  it('says when a download fails', async () => {
    reportHandlers();
    server.use(
      http.get('/api/reports/download/3', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/reports');

    const cards = await screen.findByRole('list', { name: 'Monthly reports' });
    await user.click(within(cards).getByRole('button', { name: /Download September 2026/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The download failed: Server Error');
  });

  it('pages through reports with the page in the URL', async () => {
    const requests = reportHandlers();
    const { user, router } = renderApp('/reports');

    await user.click(await screen.findByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ page: 2 }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('page')).toBe('2'));
    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument();
  });

  it('explains when weekly reports are generated while there are none', async () => {
    reportHandlers();
    const { user, router } = renderApp('/reports');

    await user.click(await screen.findByRole('tab', { name: 'Weekly' }));

    expect(await screen.findByText('No weekly reports yet.')).toBeInTheDocument();
    expect(
      screen.getByText('Weekly reports are generated every Monday at 03:00 UTC, one per village.'),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ type: 'weekly' });
  });

  it('lists outsourced ticket payout reports and downloads them from the tickets API', async () => {
    const requests = reportHandlers();
    let downloaded = false;
    server.use(
      http.get('/api/tickets/reports/download/9', () => {
        downloaded = true;
        return HttpResponse.text('xlsx');
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    const { user } = renderApp('/reports?type=outsourced');

    const table = await screen.findByRole('table', { name: 'Ticket payouts reports' });
    const row = within(table).getByRole('row', { name: /October 2026/ });
    expect(row).toHaveTextContent('Outsourced ticket payouts');
    expect(requests.at(-1)?.searchParams.get('per_page')).toBe('15');

    await user.click(within(row).getByRole('button'));
    await waitFor(() => expect(downloaded).toBe(true));
  });

  it('says when the reports cannot be loaded', async () => {
    server.use(
      http.get('/api/reports', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    renderApp('/reports');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load reports: Down');
  });

  it('tells users without the reports permission why there is nothing', async () => {
    signIn({ permissions: ['customers'] });
    renderApp('/reports');

    expect(await screen.findByText('Reports need the reports permission.')).toBeInTheDocument();
  });
});
