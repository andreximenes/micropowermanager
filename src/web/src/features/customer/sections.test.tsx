import { render, screen } from '@testing-library/react';

import { summarizeContract } from './contractSummary';
import {
  ContactCard,
  ContractCard,
  DocumentsList,
  LocationCard,
  PaymentsTable,
  TicketsList,
} from './sections';

import {
  addressFixture,
  contractFixture,
  documentFixture,
  geoAt,
  paymentFixture,
  personFixture,
  rateFixture,
  ticketFixture,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

async function renderContract(overrides: Parameters<typeof contractFixture>[0]) {
  renderWithProviders(
    <ContractCard summary={summarizeContract(contractFixture(overrides))} currency="TZS" />,
  );
  await screen.findByRole('link', { name: 'Open contract' });
}

describe('ContractCard', () => {
  it('shows installment progress and links to the contract page', async () => {
    await renderContract({});

    expect(await screen.findByText('Solar Kit')).toBeInTheDocument();
    expect(
      screen.getByText(/Installments · 3 · started 01 Feb 2025 · serial SN-100/),
    ).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByText('TZS 400 of TZS 1,200')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Installments paid' })).toHaveAttribute(
      'aria-valuenow',
      '33',
    );
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open contract' })).toHaveAttribute(
      'href',
      '/contracts/21',
    );
  });

  it('mentions a down payment and falls back to a generic product name', async () => {
    await renderContract({ down_payment: 200, appliance: null, device_serial: null, created_at: null });

    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Installments · 3 + down payment · started —')).toBeInTheDocument();
  });

  it('shows an energy-as-a-service contract by its daily price', async () => {
    await renderContract({ payment_type: 'energy_service', price_per_day: 50, rates: [] });

    expect(screen.getByText(/^Energy as a service/)).toBeInTheDocument();
    expect(screen.getByText('TZS 50 per day')).toBeInTheDocument();
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows zero per day when the daily price is missing', async () => {
    await renderContract({ payment_type: 'energy_service', price_per_day: null, rates: [] });

    expect(screen.getByText('TZS 0 per day')).toBeInTheDocument();
  });

  it('marks overdue and paid-off contracts', async () => {
    await renderContract({ rates: [rateFixture({ due_date: '2020-01-01' })] });
    expect(screen.getByText('Overdue')).toBeInTheDocument();

    await renderContract({ rates: [rateFixture({ remaining: 0 })] });
    expect(screen.getByText('Paid off')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')[1]).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows no progress for an installment contract without rates', async () => {
    await renderContract({ rates: [] });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('PaymentsTable', () => {
  it('lists each payment with its purpose, channel, token and amount', () => {
    render(
      <PaymentsTable
        currency="TZS"
        payments={[
          paymentFixture(),
          paymentFixture({ id: 32, payment_service: null, transaction: null, amount: 1500.5 }),
        ]}
      />,
    );

    const [, first, second] = screen.getAllByRole('row');
    expect(first).toHaveTextContent('04 Mar 2026appliance rateWavecomTOKEN-123TZS 400');
    expect(second).toHaveTextContent('04 Mar 2026appliance rate——TZS 1,500.5');
  });

  it('shows an empty state', () => {
    render(<PaymentsTable payments={[]} currency="TZS" />);

    expect(screen.getByText('No payments yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('ContactCard', () => {
  it('shows the primary address and asks to edit', async () => {
    const onEdit = vi.fn();
    render(
      <ContactCard
        onEdit={onEdit}
        person={personFixture({
          addresses: [
            addressFixture({ id: 1, is_primary: 0, phone: '+255 secondary' }),
            addressFixture({ id: 2, is_primary: 1, phone: '+255 primary' }),
          ],
        })}
      />,
    );

    expect(screen.getByText('+255 primary')).toBeInTheDocument();
    expect(screen.getByText('amina@example.com')).toBeInTheDocument();
    expect(screen.getByText('female')).toBeInTheDocument();
    expect(screen.getByText('15 Jan 2025')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Edit' }).click();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('falls back to the first address, and to dashes for missing details', () => {
    render(
      <ContactCard
        onEdit={() => undefined}
        person={personFixture({
          gender: null,
          created_at: null,
          addresses: [
            addressFixture({ is_primary: 0, phone: null, email: null, street: null, city: null }),
          ],
        })}
      />,
    );

    expect(screen.getAllByText('—')).toHaveLength(5);
  });

  it('shows the city alone when the street is missing', () => {
    render(
      <ContactCard
        person={personFixture({ addresses: [addressFixture({ street: null })] })}
        onEdit={() => undefined}
      />,
    );

    expect(screen.getByText('Dar es Salaam')).toBeInTheDocument();
  });
});

describe('LocationCard', () => {
  it('prefers the location of a device', () => {
    render(
      <LocationCard
        person={personFixture({
          devices: [
            { id: 1, device_type: 'meter', device_serial: 'NO-GEO', geo: null },
            {
              id: 2,
              device_type: 'shs',
              device_serial: 'SN-555',
              geo: geoAt(-6.123456, 39.654321),
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'Customer location' })).toBeInTheDocument();
    expect(screen.getByText('Device SN-555 · -6.1235, 39.6543')).toBeInTheDocument();
  });

  it('falls back to the home address', () => {
    render(<LocationCard person={personFixture()} />);

    expect(screen.getByText('Home address · -6.8000, 39.2800')).toBeInTheDocument();
  });

  it('shows an empty state without any location', () => {
    render(<LocationCard person={personFixture({ addresses: [addressFixture({ geo: null })] })} />);

    expect(screen.getByText('No location recorded.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Customer location' })).not.toBeInTheDocument();
  });
});

describe('DocumentsList', () => {
  it('links each document to its download', () => {
    render(
      <DocumentsList
        documents={[
          documentFixture(),
          documentFixture({ id: 42, original_name: null, name: 'scan.png' }),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'National ID.pdf' })).toHaveAttribute(
      'href',
      '/api/person-documents/41/download',
    );
    expect(screen.getByRole('link', { name: 'scan.png' })).toHaveAttribute(
      'href',
      '/api/person-documents/42/download',
    );
  });
});

describe('TicketsList', () => {
  it('labels open, closed and unknown statuses', () => {
    render(
      <TicketsList
        tickets={[
          ticketFixture({ id: 1, title: 'Open one', status: 0 }),
          ticketFixture({ id: 2, title: 'Closed one', status: 1 }),
          ticketFixture({ id: 3, title: 'Odd one', status: 9 }),
        ]}
      />,
    );

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Open oneOpen',
      'Closed oneClosed',
      'Odd oneUnknown',
    ]);
  });
});
