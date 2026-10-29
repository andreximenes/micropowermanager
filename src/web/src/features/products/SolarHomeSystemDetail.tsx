import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Sun } from 'lucide-react';
import { useState } from 'react';

import { fetchContracts, fetchMainSettings } from '@/api/customers';
import {
  deleteSolarHomeSystem,
  fetchSolarHomeSystem,
  fetchSolarHomeSystemTransactions,
  type DeviceTransaction,
  type Owner,
  type SolarHomeSystem,
} from '@/api/solarHomeSystems';
import { can, readSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LocationMap } from '@/components/LocationMap';
import { Pagination } from '@/components/Pagination';
import { summarizeContract } from '@/features/customer/contractSummary';
import { EmptyState, SectionCard } from '@/features/customer/sections';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  initials,
  paymentChannel,
  sentenceCase,
} from '@/lib/format';
import { pointOf } from '@/lib/geo';

import { DeviceControl } from './DeviceControl';
import { EditSolarHomeSystemSheet } from './EditSolarHomeSystemSheet';
import { mappingPill, ownerOf, ownershipPill } from './solarHomeSystem';

const transactionPageSizes = [10, 25, 50] as const;
type TransactionPageSize = (typeof transactionPageSizes)[number];

export function SolarHomeSystemDetail({ solarHomeSystemId }: { solarHomeSystemId: number }) {
  const session = readSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<'edit' | 'delete' | null>(null);
  const detail = useQuery({
    queryKey: ['solar-home-system', solarHomeSystemId],
    queryFn: () => fetchSolarHomeSystem(solarHomeSystemId),
  });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';

  if (detail.isPending) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Loading solar home system…</p>
    );
  }
  if (detail.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load this solar home system: {detail.error.message}
      </Banner>
    );
  }

  const solarHomeSystem = detail.data;
  const owner = ownerOf(solarHomeSystem);
  const ownership = ownershipPill(solarHomeSystem);
  const mapping = mappingPill[solarHomeSystem.device?.manufacturer_mapping_status ?? 'unknown'];

  return (
    <>
      <div className="flex flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/solar-home-systems" className="hover:underline">
            Solar home systems
          </Link>{' '}
          / <span className="break-all">{solarHomeSystem.serial_number}</span>
        </nav>

        <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel p-4 shadow-sm sm:gap-5 sm:p-6">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tile sm:size-16"
            aria-hidden="true"
          >
            <Sun className="size-6 text-green-bright sm:size-7" />
          </span>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 font-mono text-xl font-bold break-all sm:text-2xl">
                {solarHomeSystem.serial_number}
              </h1>
              <StatusPill status={ownership.status}>{ownership.label}</StatusPill>
              <StatusPill status={mapping.status}>{mapping.label}</StatusPill>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>{solarHomeSystem.appliance?.name ?? 'No product'}</span>
              <span>Manufacturer {solarHomeSystem.manufacturer?.name ?? '—'}</span>
              <span>Added {formatDate(solarHomeSystem.created_at)}</span>
              <span>Last update {formatDateTime(solarHomeSystem.updated_at)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPanel('edit')}>
              Edit
            </Button>
            <Button variant="outline" className="text-red" onClick={() => setPanel('delete')}>
              Delete
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            {solarHomeSystem.device && can(session, 'transactions') ? (
              <DeviceControl
                solarHomeSystem={solarHomeSystem}
                deviceId={solarHomeSystem.device.id}
                currency={currency}
              />
            ) : null}
            <TransactionsCard solarHomeSystemId={solarHomeSystem.id} currency={currency} />
          </div>
          <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
            <OwnerCard
              owner={owner}
              serial={solarHomeSystem.serial_number}
              currency={currency}
              showContract={can(session, 'customers')}
            />
            <LocationCard solarHomeSystem={solarHomeSystem} owner={owner} />
          </aside>
        </div>
      </div>

      {panel === 'edit' ? (
        <EditSolarHomeSystemSheet
          solarHomeSystem={solarHomeSystem}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${solarHomeSystem.serial_number}?`}
          description="The device disappears from the list. A device with payments, tokens or a sale can't be deleted."
          confirmLabel="Delete device"
          pendingLabel="Deleting…"
          failureLabel="The device was not deleted"
          onConfirm={() => deleteSolarHomeSystem(solarHomeSystem.id)}
          onDone={async () => {
            queryClient.removeQueries({ queryKey: ['solar-home-system', solarHomeSystem.id] });
            await queryClient.invalidateQueries({ queryKey: ['solar-home-systems'] });
            await navigate({ to: '/solar-home-systems' });
          }}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </>
  );
}

function OwnerCard({
  owner,
  serial,
  currency,
  showContract,
}: {
  owner: Owner | null;
  serial: string;
  currency: string;
  showContract: boolean;
}) {
  const contracts = useQuery({
    queryKey: ['contracts', owner?.id],
    queryFn: () => fetchContracts(owner?.id as number),
    enabled: owner !== null && showContract,
  });

  if (!owner) {
    return (
      <SectionCard title="Owner">
        <EmptyState>
          In stock: no customer owns this device yet. Sell it from a customer&apos;s profile.
        </EmptyState>
      </SectionCard>
    );
  }

  const address =
    owner.addresses?.find((candidate) => candidate.is_primary === 1) ?? owner.addresses?.[0];
  const contract = contracts.data?.find(
    (candidate) => candidate.device_serial === serial && candidate.deleted_at === null,
  );
  const summary = contract ? summarizeContract(contract) : null;

  return (
    <SectionCard
      title="Owner"
      action={
        <Link
          to="/customers/$customerId"
          params={{ customerId: owner.id }}
          className="text-sm underline"
        >
          Open profile
        </Link>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-tile text-sm font-semibold text-white"
          >
            {initials(owner.name, owner.surname)}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">
              {owner.name} {owner.surname}
            </span>
            <span className="block text-sm text-muted-foreground">
              {[address?.phone, address?.city?.name].filter(Boolean).join(' · ') ||
                'No contact details'}
            </span>
          </span>
        </div>
        {contract && summary ? (
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Contract</dt>
            <dd className="m-0">
              <Link
                to="/contracts/$contractId"
                params={{ contractId: contract.id }}
                className="hover:underline"
              >
                {contract.appliance?.name ?? 'Product'}
                {contract.payment_type === 'installment'
                  ? ` · ${contract.rate_count} installments`
                  : ' · energy as a service'}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="m-0">
              {formatMoney(summary.paidAmount, currency)}
              {contract.payment_type === 'installment'
                ? ` of ${formatMoney(contract.total_cost, currency)}`
                : ''}
            </dd>
          </dl>
        ) : null}
      </div>
    </SectionCard>
  );
}

function LocationCard({
  solarHomeSystem,
  owner,
}: {
  solarHomeSystem: SolarHomeSystem;
  owner: Owner | null;
}) {
  // The device's own point is where it is installed, whoever owns it.
  const point = pointOf(solarHomeSystem.device?.geo);
  const street = owner?.addresses?.find((address) => address.is_primary === 1)?.street;
  return (
    <SectionCard title="Location">
      {point ? (
        <div className="flex flex-col gap-2 p-4">
          <LocationMap
            position={point}
            label={`Map with the location of ${solarHomeSystem.serial_number}`}
            className="h-48 w-full overflow-hidden rounded-lg border border-border"
          />
          <p className="m-0 text-xs text-muted-foreground">
            {[street, `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ) : (
        <EmptyState>No location recorded for this device.</EmptyState>
      )}
    </SectionCard>
  );
}

function tokenCredit(transaction: DeviceTransaction): string {
  const token = transaction.paid_for;
  if (!token?.token_amount) {
    return '—';
  }
  return `${token.token_amount} ${token.token_unit ?? ''}`.trim();
}

function TransactionsCard({
  solarHomeSystemId,
  currency,
}: {
  solarHomeSystemId: number;
  currency: string;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<TransactionPageSize>(10);
  const transactions = useQuery({
    queryKey: ['solar-home-system-transactions', solarHomeSystemId, page, perPage],
    queryFn: () => fetchSolarHomeSystemTransactions(solarHomeSystemId, page, perPage),
    placeholderData: keepPreviousData,
  });
  const rows = transactions.data?.data ?? [];

  return (
    <SectionCard title="Transactions">
      {transactions.isPending ? <EmptyState>Loading transactions…</EmptyState> : null}
      {transactions.isError ? (
        <div className="p-4">
          <Banner tone="error" role="alert">
            Could not load the transactions: {transactions.error.message}
          </Banner>
        </div>
      ) : null}
      {transactions.data && rows.length === 0 ? <EmptyState>No payments yet.</EmptyState> : null}
      {rows.length > 0 ? (
        <>
          <Table aria-label="Transactions" className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-6">Token</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="pl-6 whitespace-nowrap">
                    {formatDate(transaction.created_at)}
                  </TableCell>
                  <TableCell>{paymentChannel(transaction.payment_service)}</TableCell>
                  <TableCell>{sentenceCase(transaction.payment_type)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatMoney(transaction.amount, currency)}
                  </TableCell>
                  <TableCell className="pr-6">{tokenCredit(transaction)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ul
            aria-label="Transactions"
            className="m-0 list-none divide-y divide-border p-0 sm:hidden"
          >
            {rows.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 text-sm">
                  <span className="block">{formatDate(transaction.created_at)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {paymentChannel(transaction.payment_service)} ·{' '}
                    {sentenceCase(transaction.payment_type)} · {tokenCredit(transaction)}
                  </span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {formatMoney(transaction.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {transactions.data && transactions.data.total > 0 ? (
        <Pagination
          page={transactions.data}
          noun="payment"
          perPage={perPage}
          perPageOptions={transactionPageSizes}
          onPage={setPage}
          onPerPage={(size) => {
            setPerPage(size);
            setPage(1);
          }}
        />
      ) : null}
    </SectionCard>
  );
}
