import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card, CardHeader, CardTitle } from '@spark/ui/card';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useMutation } from '@tanstack/react-query';
import { Sun, Trash2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { type ReactNode } from 'react';

import { downloadDocument } from '@/api/customers';
import type { Contract, CustomerDocument, Payment, Person, Ticket } from '@/api/schemas';
import { LocationMap } from '@/components/LocationMap';
import { saveFile } from '@/lib/download';
import { formatDate, formatMoney, paymentChannel } from '@/lib/format';
import { pointOf } from '@/lib/geo';

import { summarizeContract, type ContractSummary } from './contractSummary';

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="min-w-0 px-4 py-3 sm:px-5 sm:py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold break-words sm:text-2xl">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-6 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function planLabel(contract: Contract): string {
  if (contract.payment_type === 'energy_service') {
    return 'Energy as a service';
  }
  const downPayment = contract.down_payment ? ' + down payment' : '';
  return `Installments · ${contract.rate_count}${downPayment}`;
}

export function ContractCard({ summary, currency }: { summary: ContractSummary; currency: string }) {
  const { contract } = summary;
  const progress = summary.totalRates === 0 ? 0 : Math.round((summary.paidRates / summary.totalRates) * 100);
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 place-items-center rounded-xl bg-tile" aria-hidden="true">
          <Sun className="size-6 text-green-bright" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{contract.appliance?.name ?? 'Product'}</div>
          <div className="text-sm text-muted-foreground">
            {planLabel(contract)} · started {formatDate(contract.created_at)}
            {contract.device_serial ? ` · serial ${contract.device_serial}` : ''}
          </div>
        </div>
        {summary.overdue ? (
          <StatusPill status="error">Overdue</StatusPill>
        ) : summary.outstanding === 0 && contract.payment_type === 'installment' ? (
          <StatusPill status="success">Paid off</StatusPill>
        ) : (
          <StatusPill status="success">On track</StatusPill>
        )}
      </div>
      {contract.payment_type === 'installment' ? (
        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span>
              <strong>
                {summary.paidRates} of {summary.totalRates}
              </strong>{' '}
              payments made
            </span>
            <span className="text-muted-foreground">
              {formatMoney(summary.paidAmount, currency)} of {formatMoney(contract.total_cost, currency)}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-panel-2"
            role="progressbar"
            aria-label="Installments paid"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-gradient-to-r from-green-bright to-teal" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <div className="text-sm">
          {formatMoney(contract.price_per_day ?? 0, currency)} per day
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/contracts/$contractId" params={{ contractId: contract.id }}>
            Open contract
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function PaymentsTable({ payments, currency }: { payments: Payment[]; currency: string }) {
  if (payments.length === 0) {
    return <EmptyState>No payments yet.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="hidden sm:table-cell">For</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="hidden md:table-cell">Token</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="whitespace-nowrap">{formatDate(payment.created_at)}</TableCell>
              <TableCell className="hidden capitalize sm:table-cell">{payment.payment_type.replace(/_/g, ' ')}</TableCell>
              <TableCell>{paymentChannel(payment.payment_service)}</TableCell>
              <TableCell className="hidden tabular-nums text-xs md:table-cell">{payment.transaction?.token?.token ?? '—'}</TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">{formatMoney(payment.amount, currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ContactCard({ person, onEdit }: { person: Person; onEdit: () => void }) {
  const primary = person.addresses.find((address) => address.is_primary === 1) ?? person.addresses[0];
  const rows: [string, string][] = [
    ['Phone', primary?.phone ?? '—'],
    ['E-mail', primary?.email ?? '—'],
    ['Address', [primary?.street, primary?.city?.name].filter(Boolean).join(', ') || '—'],
    ['Gender', person.gender ?? '—'],
    ['Customer since', formatDate(person.created_at)],
  ];
  return (
    <SectionCard
      title="Contact"
      action={
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
      }
    >
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2.5 px-6 py-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

export function LocationCard({ person }: { person: Person }) {
  const device = person.devices.find((item) => pointOf(item.geo));
  const primary = person.addresses.find((address) => address.is_primary === 1) ?? person.addresses[0];
  const point = pointOf(device?.geo) ?? pointOf(primary?.geo);
  return (
    <SectionCard title="Location">
      {point ? (
        <>
          <LocationMap position={point} label="Customer location" className="h-44 w-full" />
          <p className="px-6 py-3 text-xs text-muted-foreground">
            {device ? `Device ${device.device_serial}` : 'Home address'} · {point.latitude.toFixed(4)},{' '}
            {point.longitude.toFixed(4)}
          </p>
        </>
      ) : (
        <EmptyState>No location recorded.</EmptyState>
      )}
    </SectionCard>
  );
}

export function DocumentsList({
  documents,
  onDelete,
}: {
  documents: CustomerDocument[];
  /** Offers a delete button per document when given. */
  onDelete?: (document: CustomerDocument) => void;
}) {
  // The download needs the session's bearer token, so it goes through the API client.
  const download = useMutation({
    mutationFn: (document: CustomerDocument) => downloadDocument(document.id),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });

  if (documents.length === 0) {
    return <EmptyState>No documents uploaded.</EmptyState>;
  }
  return (
    <>
      {download.isError ? (
        <div className="px-6 pt-4">
          <Banner tone="error" role="alert">
            The document was not downloaded: {download.error.message}
          </Banner>
        </div>
      ) : null}
      <ul className="divide-y divide-border px-6 text-sm">
        {documents.map((document) => {
          const name = document.original_name ?? document.name;
          return (
            <li key={document.id} className="flex items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <button
                  type="button"
                  disabled={download.isPending}
                  onClick={() => download.mutate(document)}
                  className="max-w-full cursor-pointer truncate text-left underline-offset-2 hover:underline disabled:cursor-wait"
                >
                  {name}
                </button>
                {document.type ? (
                  <span className="text-xs text-muted-foreground">{document.type}</span>
                ) : null}
              </div>
              <span className="shrink-0 text-muted-foreground">{formatDate(document.created_at)}</span>
              {onDelete ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${name}`}
                  onClick={() => onDelete(document)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

const ticketStatus: Record<number, string> = { 0: 'Open', 1: 'Closed' };

export function TicketsList({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return <EmptyState>No tickets.</EmptyState>;
  }
  return (
    <ul className="divide-y divide-border px-6 text-sm">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="flex items-center justify-between gap-3 py-3">
          <Link
            to="/tickets"
            search={{ ticket: ticket.id, status: ticket.status === 1 ? 'closed' : undefined }}
            className="truncate hover:underline"
          >
            {ticket.title}
          </Link>
          <StatusPill status={ticket.status === 0 ? 'warning' : 'neutral'}>{ticketStatus[ticket.status] ?? 'Unknown'}</StatusPill>
        </li>
      ))}
    </ul>
  );
}

export function ContractsList({ contracts, currency }: { contracts: Contract[]; currency: string }) {
  if (contracts.length === 0) {
    return <EmptyState>No products sold to this customer yet.</EmptyState>;
  }
  return (
    <div className="divide-y divide-border">
      {contracts.map((contract) => (
        <ContractCard key={contract.id} summary={summarizeContract(contract)} currency={currency} />
      ))}
    </div>
  );
}

