import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { CustomerProfile } from './CustomerProfile';

import {
  applianceFixture,
  productFixture,
  contractFixture,
  customerHandlers,
  documentFixture,
  paymentFixture,
  personFixture,
  rateFixture,
  signIn,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';

function renderProfile() {
  return renderWithProviders(<CustomerProfile customerId={7} />);
}

/** A KPI card is its label followed by the value and hint. */
function kpi(label: string) {
  const card = screen.getByText(label).parentElement;
  if (!card) {
    throw new Error(`No KPI labelled ${label}`);
  }
  return card;
}

/** Tabs append their count as a badge, so a tab is found by the start of its name. */
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });

const customerHeading = () => screen.findByRole('heading', { level: 1, name: 'Amina Okafor' });

describe('CustomerProfile', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows a loading state until the customer arrives', async () => {
    server.use(...customerHandlers());
    renderProfile();

    expect(await screen.findByText('Loading customer…')).toBeInTheDocument();
    expect(await customerHeading()).toBeInTheDocument();
  });

  it('shows the customer header and KPIs from the contracts and payments', async () => {
    server.use(...customerHandlers());
    renderProfile();

    await customerHeading();
    expect(await screen.findByText('Paying on time')).toBeInTheDocument();
    expect(screen.getByText('ID 7')).toBeInTheDocument();
    expect(screen.getByText('+255700000001', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Customers / Amina Okafor',
    );
    expect(kpi('Outstanding')).toHaveTextContent('TZS 800of TZS 1,200');
    expect(kpi('Next installment')).toHaveTextContent('TZS 400due 01 Jan 2099');
    expect(kpi('Paid so far')).toHaveTextContent('TZS 400');
    expect(kpi('Last payment')).toHaveTextContent('TZS 40004 Mar 2026');
  });

  it('shows the active contract, recent payments, contact, location and documents on the overview', async () => {
    server.use(...customerHandlers());
    renderProfile();

    await customerHeading();
    expect(await screen.findByText('Solar Kit')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Installments paid' })).toHaveAttribute(
      'aria-valuenow',
      '33',
    );
    expect(await screen.findByRole('cell', { name: 'Wavecom' })).toBeInTheDocument();
    expect(screen.getByText('Kariakoo Street, Dar es Salaam')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Customer location' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'National ID.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete National ID.pdf' })).not.toBeInTheDocument();
  });

  it('counts contracts, documents and tickets on the tabs and switches between them', async () => {
    server.use(
      ...customerHandlers({
        documents: [documentFixture(), documentFixture({ id: 42, original_name: 'Contract.pdf' })],
      }),
    );
    const { user } = renderProfile();
    await customerHeading();

    await vi.waitFor(() => expect(tab('Contracts')).toHaveTextContent('Contracts1'));
    await vi.waitFor(() => expect(tab('Documents')).toHaveTextContent('Documents2'));
    await vi.waitFor(() => expect(tab('Tickets')).toHaveTextContent('Tickets1'));
    expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');

    await user.click(tab('Tickets'));
    expect(tab('Tickets')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Panel not charging')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Recent payments')).not.toBeInTheDocument();

    await user.click(tab('Documents'));
    expect(screen.getByRole('button', { name: 'Contract.pdf' })).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();

    await user.click(tab('Contracts'));
    expect(screen.getByText('Solar Kit')).toBeInTheDocument();

    await user.click(tab('Payments'));
    expect(screen.getByRole('cell', { name: 'TOKEN-123' })).toBeInTheDocument();
  });

  it('uploads a document from the documents tab', async () => {
    server.use(...customerHandlers());
    const { user } = renderProfile();
    await customerHeading();
    await vi.waitFor(() => expect(tab('Documents')).toHaveTextContent('Documents1'));
    await user.click(tab('Documents'));

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    const sheet = await screen.findByRole('dialog', { name: 'Upload document' });
    expect(within(sheet).getByText(/For Amina Okafor/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stops offering uploads once the customer has three documents', async () => {
    server.use(
      ...customerHandlers({
        documents: [1, 2, 3].map((id) => documentFixture({ id, original_name: `Doc ${id}.pdf` })),
      }),
    );
    const { user } = renderProfile();
    await customerHeading();
    await vi.waitFor(() => expect(tab('Documents')).toHaveTextContent('Documents3'));
    await user.click(tab('Documents'));

    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('deletes a document after confirming and refreshes the list', async () => {
    let documents = [documentFixture()];
    let deleted: string | undefined;
    server.use(...customerHandlers());
    server.use(
      http.get('/api/people/7/documents', () => HttpResponse.json({ data: documents })),
      http.delete('/api/person-documents/:documentId', ({ params }) => {
        deleted = String(params.documentId);
        documents = [];
        return HttpResponse.json({ data: { message: 'deleted' } });
      }),
    );
    const { user } = renderProfile();
    await customerHeading();
    await vi.waitFor(() => expect(tab('Documents')).toHaveTextContent('Documents1'));
    await user.click(tab('Documents'));

    await user.click(screen.getByRole('button', { name: 'Delete National ID.pdf' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete document' });
    expect(dialog).toHaveTextContent('National ID.pdf is removed for good.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete document' }));

    expect(await screen.findByText('No documents uploaded.')).toBeInTheDocument();
    expect(deleted).toBe('41');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens all payments from the overview', async () => {
    const payments = Array.from({ length: 7 }, (_, index) =>
      paymentFixture({ id: index + 1, amount: (index + 1) * 100 }),
    );
    server.use(...customerHandlers({ payments }));
    const { user } = renderProfile();
    await customerHeading();

    expect(await screen.findAllByRole('row')).toHaveLength(6);

    await user.click(screen.getByRole('button', { name: 'All payments' }));

    expect(tab('Payments')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('shows empty states for a new customer', async () => {
    server.use(
      ...customerHandlers({
        person: personFixture({ addresses: [], gender: null }),
        contracts: [],
        payments: [],
        documents: [],
        tickets: [],
      }),
    );
    const { user } = renderProfile();
    await customerHeading();

    expect(await screen.findByText('No contract yet')).toBeInTheDocument();
    expect(screen.getByText('No products sold to this customer yet.')).toBeInTheDocument();
    expect(await screen.findByText('No payments yet.')).toBeInTheDocument();
    expect(screen.getByText('No location recorded.')).toBeInTheDocument();
    expect(await screen.findByText('No documents uploaded.')).toBeInTheDocument();
    expect(kpi('Outstanding')).toHaveTextContent(/^OutstandingTZS 0$/);
    expect(kpi('Next installment')).toHaveTextContent('—Nothing due');
    expect(kpi('Last payment')).toHaveTextContent('—No payments yet');
    expect(tab('Contracts')).toHaveTextContent(/^Contracts$/);

    await user.click(tab('Tickets'));
    expect(await screen.findByText('No tickets.')).toBeInTheDocument();

    await user.click(tab('Contracts'));
    expect(screen.getByText('No products sold to this customer yet.')).toBeInTheDocument();
  });

  it('flags an overdue customer', async () => {
    server.use(
      ...customerHandlers({
        contracts: [contractFixture({ rates: [rateFixture({ due_date: '2020-01-01' })] })],
      }),
    );
    renderProfile();

    expect(await screen.findByText('Payment overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows a paid-off customer', async () => {
    server.use(
      ...customerHandlers({
        contracts: [contractFixture({ rates: [rateFixture({ remaining: 0 })] })],
      }),
    );
    renderProfile();

    expect(await screen.findAllByText('Paid off')).toHaveLength(2);
  });

  it('leaves cancelled contracts out of the totals', async () => {
    server.use(
      ...customerHandlers({
        contracts: [
          contractFixture(),
          contractFixture({
            id: 22,
            deleted_at: '2025-03-01',
            appliance: applianceFixture({ name: 'Cancelled TV' }),
          }),
        ],
      }),
    );
    const { user } = renderProfile();
    await customerHeading();

    expect(await screen.findByText('Solar Kit')).toBeInTheDocument();
    expect(kpi('Outstanding')).toHaveTextContent('TZS 800of TZS 1,200');

    await user.click(tab('Contracts'));
    expect(screen.queryByText('Cancelled TV')).not.toBeInTheDocument();
  });

  it('reports a customer that cannot be loaded', async () => {
    server.use(
      http.get('/api/people/7', () => HttpResponse.json({ message: 'Not found' }, { status: 404 })),
      ...customerHandlers(),
    );
    renderProfile();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this customer: Not found',
    );
  });

  it('hides what the user is not allowed to see', async () => {
    signIn({ permissions: ['customers'] });
    server.use(...customerHandlers());
    renderProfile();
    await customerHeading();

    expect(await screen.findByText('No contract yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Sell product' })).not.toBeInTheDocument();
    expect(screen.getByText('No payments yet.')).toBeInTheDocument();
  });

  it('opens and closes the sell product sheet', async () => {
    server.use(
      ...customerHandlers(),
      http.get('/api/appliances', () => HttpResponse.json({ data: [productFixture()] })),
    );
    const { user } = renderProfile();
    await customerHeading();

    await user.click(screen.getByRole('button', { name: '+ Sell product' }));

    const sheet = screen.getByRole('dialog', { name: 'Sell product' });
    expect(sheet).toHaveAccessibleDescription('to Amina Okafor');

    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
