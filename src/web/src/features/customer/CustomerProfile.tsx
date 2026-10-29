import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { StatusPill } from '@spark/ui/status-pill';
import { Tab, Tabs } from '@spark/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  fetchContracts,
  fetchCustomer,
  fetchDocuments,
  fetchMainSettings,
  fetchPayments,
  fetchTickets,
} from '@/api/customers';
import { can, readSession } from '@/auth/session';
import { CustomerForm } from '@/features/customers/CustomerForm';
import { legacyHref } from '@/legacy';
import { formatDate, formatMoney, initials } from '@/lib/format';

import { activeContracts, customerStanding, summarizeContract, type CustomerStanding } from './contractSummary';
import {
  ContactCard,
  ContractCard,
  ContractsList,
  DocumentsList,
  EmptyState,
  Kpi,
  LocationCard,
  PaymentsTable,
  SectionCard,
  TicketsList,
} from './sections';
import { SellProductSheet } from './SellProductSheet';

const tabs = ['Overview', 'Contracts', 'Payments', 'Documents', 'Tickets'] as const;
type TabName = (typeof tabs)[number];

const standingPill: Record<CustomerStanding, { status: 'success' | 'error' | 'neutral'; label: string }> = {
  overdue: { status: 'error', label: 'Payment overdue' },
  'on-track': { status: 'success', label: 'Paying on time' },
  'paid-off': { status: 'success', label: 'Paid off' },
  'no-contract': { status: 'neutral', label: 'No contract yet' },
};

export function CustomerProfile({ customerId }: { customerId: number }) {
  const session = readSession();
  const [tab, setTab] = useState<TabName>('Overview');
  const [selling, setSelling] = useState(false);
  const [editing, setEditing] = useState(false);

  const customer = useQuery({ queryKey: ['customer', customerId], queryFn: () => fetchCustomer(customerId) });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const contracts = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => fetchContracts(customerId),
    enabled: can(session, 'appliances'),
  });
  const payments = useQuery({
    queryKey: ['payments', customerId],
    queryFn: () => fetchPayments(customerId),
    enabled: can(session, 'transactions'),
  });
  const documents = useQuery({ queryKey: ['documents', customerId], queryFn: () => fetchDocuments(customerId) });
  const tickets = useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => fetchTickets(customerId),
    enabled: can(session, 'tickets'),
  });

  if (customer.isPending) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading customer…</p>;
  }
  if (customer.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load this customer: {customer.error.message}
      </Banner>
    );
  }

  const person = customer.data;
  const currency = settings.data?.currency ?? '';
  const summaries = activeContracts(contracts.data ?? []).map((contract) => summarizeContract(contract));
  const standing = standingPill[customerStanding(summaries)];
  const outstanding = summaries.reduce((sum, summary) => sum + summary.outstanding, 0);
  const totalCost = summaries.reduce((sum, summary) => sum + summary.contract.total_cost, 0);
  const paid = summaries.reduce((sum, summary) => sum + summary.paidAmount, 0);
  const nextRate = summaries
    .map((summary) => summary.nextRate)
    .filter((rate) => rate !== null)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const lastPayment = payments.data?.data[0];
  const primary = person.addresses.find((address) => address.is_primary === 1) ?? person.addresses[0];
  const counts: Partial<Record<TabName, number>> = {
    Contracts: activeContracts(contracts.data ?? []).length,
    Documents: documents.data?.length,
    Tickets: tickets.data?.total,
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/customers" className="hover:underline">
            Customers
          </Link>{' '}
          / {person.name} {person.surname}
        </nav>

        <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel p-4 shadow-sm sm:gap-5 sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tile text-lg sm:size-16 sm:text-xl font-semibold text-white" aria-hidden="true">
            {initials(person.name, person.surname)}
          </span>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 text-xl font-bold sm:text-2xl">
                {person.name} {person.surname}
              </h1>
              <StatusPill status={standing.status}>{standing.label}</StatusPill>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>ID {person.id}</span>
              {primary?.phone ? <span>{primary.phone}</span> : null}
              {primary?.city ? <span>{primary.city.name}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit customer
            </Button>
            <Button asChild variant="outline">
              <a href={legacyHref(`/people/${person.id}?legacy=1`)}>New ticket</a>
            </Button>
            {can(session, 'appliances') ? <Button onClick={() => setSelling(true)}>+ Sell product</Button> : null}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Kpi label="Outstanding" value={formatMoney(outstanding, currency)} hint={totalCost > 0 ? `of ${formatMoney(totalCost, currency)}` : undefined} />
          <Kpi
            label="Next installment"
            value={nextRate ? formatMoney(nextRate.remaining, currency) : '—'}
            hint={nextRate ? `due ${formatDate(nextRate.due_date)}` : 'Nothing due'}
          />
          <Kpi label="Paid so far" value={formatMoney(paid, currency)} />
          <Kpi
            label="Last payment"
            value={lastPayment ? formatMoney(lastPayment.amount, currency) : '—'}
            hint={lastPayment ? formatDate(lastPayment.created_at) : 'No payments yet'}
          />
        </div>

        <Tabs aria-label="Customer sections" role="tablist" className="max-w-full self-start overflow-x-auto">
          {tabs.map((name) => (
            <Tab key={name} role="tab" aria-selected={tab === name} active={tab === name} onClick={() => setTab(name)} className="shrink-0 whitespace-nowrap">
              {name}
              {counts[name] ? <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 text-xs">{counts[name]}</span> : null}
            </Tab>
          ))}
        </Tabs>

        {tab === 'Overview' ? (
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-5">
              <SectionCard title="Active contract">
                {summaries[0] ? (
                  <ContractCard summary={summaries[0]} currency={currency} />
                ) : (
                  <EmptyState>No products sold to this customer yet.</EmptyState>
                )}
              </SectionCard>
              <SectionCard
                title="Recent payments"
                action={
                  <Button size="sm" variant="ghost" onClick={() => setTab('Payments')}>
                    All payments
                  </Button>
                }
              >
                <PaymentsTable payments={(payments.data?.data ?? []).slice(0, 5)} currency={currency} />
              </SectionCard>
            </div>
            <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
              <ContactCard person={person} onEdit={() => setEditing(true)} />
              <LocationCard person={person} />
              <SectionCard title="Documents">
                <DocumentsList documents={(documents.data ?? []).slice(0, 3)} />
              </SectionCard>
            </aside>
          </div>
        ) : null}

        {tab === 'Contracts' ? (
          <SectionCard title="Contracts">
            <ContractsList contracts={activeContracts(contracts.data ?? [])} currency={currency} />
          </SectionCard>
        ) : null}
        {tab === 'Payments' ? (
          <SectionCard title="Payments">
            <PaymentsTable payments={payments.data?.data ?? []} currency={currency} />
          </SectionCard>
        ) : null}
        {tab === 'Documents' ? (
          <SectionCard
            title="Documents"
            action={
              <Button asChild size="sm" variant="outline">
                <a href={legacyHref(`/people/${person.id}?legacy=1`)}>Upload</a>
              </Button>
            }
          >
            <DocumentsList documents={documents.data ?? []} />
          </SectionCard>
        ) : null}
        {tab === 'Tickets' ? (
          <SectionCard title="Tickets">
            <TicketsList tickets={tickets.data?.data ?? []} />
          </SectionCard>
        ) : null}
      </div>

      {selling && session ? (
        <SellProductSheet
          customer={person}
          userId={session.user.id}
          currency={currency}
          onClose={() => setSelling(false)}
        />
      ) : null}
      {editing ? <CustomerForm person={person} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
