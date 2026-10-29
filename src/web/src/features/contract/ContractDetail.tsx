import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@spark/ui/dropdown-menu';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Ellipsis, Pencil, Sun } from 'lucide-react';
import { useState } from 'react';

import { ChangePlanSheet } from './ChangePlanSheet';
import { DeleteContractDialog, EditInstallmentDialog } from './ContractDialogs';
import { RecordPaymentSheet } from './RecordPaymentSheet';
import {
  canChangePlan,
  canEditRate,
  contractStatus,
  daysCovered,
  rateStatus,
  scheduleOf,
  type ContractStatus,
  type RateStatus,
  type ScheduledRate,
} from './schedule';

import {
  fetchContractDetail,
  fetchContractLogs,
  fetchSolarHomeSystem,
  type ContractDetail as Contract,
} from '@/api/contracts';
import { fetchCustomer, fetchMainSettings } from '@/api/customers';
import { can, readSession } from '@/auth/session';
import { summarizeContract, type ContractSummary } from '@/features/customer/contractSummary';
import { EmptyState, Kpi, SectionCard } from '@/features/customer/sections';
import { formatDate, formatMoney, formatMonth } from '@/lib/format';

const statusPill: Record<
  ContractStatus,
  { status: 'success' | 'error' | 'neutral'; label: string }
> = {
  deleted: { status: 'neutral', label: 'Deleted' },
  overdue: { status: 'error', label: 'Overdue' },
  'paid-off': { status: 'success', label: 'Paid off' },
  'on-track': { status: 'success', label: 'On track' },
};

const ratePill: Record<
  RateStatus,
  { status: 'success' | 'error' | 'warning' | 'neutral'; label: string }
> = {
  paid: { status: 'success', label: 'Paid' },
  overdue: { status: 'error', label: 'Overdue' },
  next: { status: 'warning', label: 'Next' },
  upcoming: { status: 'neutral', label: 'Upcoming' },
};

/** Rows shown before "Show more": a few, and always the next installment and the one after. */
const COLLAPSED_ROWS = 6;

type Panel = 'payment' | 'plan' | 'delete' | null;

function planLabel(contract: Contract): string {
  if (contract.payment_type === 'energy_service') {
    return 'Energy as a service';
  }
  return `Installments · ${contract.rate_count} ${contract.rateType}`;
}

export function ContractDetail({ contractId }: { contractId: number }) {
  const session = readSession();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<ScheduledRate | null>(null);

  const detail = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => fetchContractDetail(contractId),
  });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const personId = detail.data?.person_id;
  const customer = useQuery({
    queryKey: ['customer', personId],
    queryFn: () => fetchCustomer(personId as number),
    enabled: personId !== undefined && can(session, 'customers'),
  });

  if (detail.isPending) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading contract…</p>;
  }
  if (detail.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load this contract: {detail.error.message}
      </Banner>
    );
  }

  const contract = detail.data;
  const currency = settings.data?.currency ?? '';
  const schedule = scheduleOf(contract);
  const summary = summarizeContract(contract);
  const status = statusPill[contractStatus(summary)];
  const deleted = contract.deleted_at !== null;
  const product = contract.appliance?.name ?? 'Product';
  const customerName = customer.data
    ? `${customer.data.name} ${customer.data.surname}`
    : 'Customer';
  const canManage = !deleted && can(session, 'appliances');
  const canPay = !deleted && can(session, 'payments');

  // Every screen that shows this contract or its payments reads these.
  async function refresh() {
    await Promise.all(
      [
        ['contract', contractId],
        ['contract-logs', contractId],
        ['solar-home-system'],
        ['contracts', contract.person_id],
        ['customer', contract.person_id],
        ['payments', contract.person_id],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }

  const customerLink = (
    <Link
      to="/customers/$customerId"
      params={{ customerId: contract.person_id }}
      className="hover:underline"
    >
      {customerName}
    </Link>
  );

  return (
    <>
      <div className="flex flex-col gap-5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/customers" className="hover:underline">
            Customers
          </Link>{' '}
          / {customerLink} / {product}
        </nav>

        {deleted ? (
          <Banner tone="warning" role="status">
            This contract was deleted on {formatDate(contract.deleted_at)}. It is shown read-only.
          </Banner>
        ) : null}

        <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel p-4 shadow-sm sm:gap-5 sm:p-6">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tile sm:size-16"
            aria-hidden="true"
          >
            <Sun className="size-6 text-green-bright sm:size-7" />
          </span>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 text-xl font-bold sm:text-2xl">{product}</h1>
              <StatusPill status={status.status}>{status.label}</StatusPill>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>Sold to {customerLink}</span>
              <span>{planLabel(contract)}</span>
              <span>Sold {formatDate(contract.created_at)}</span>
              {contract.device_serial ? (
                <span className="break-all">Serial {contract.device_serial}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && canChangePlan(contract, schedule) ? (
              <Button variant="outline" onClick={() => setPanel('plan')}>
                Change plan
              </Button>
            ) : null}
            {canPay ? <Button onClick={() => setPanel('payment')}>Record payment</Button> : null}
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-red" onSelect={() => setPanel('delete')}>
                    Delete contract
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </section>

        <ContractKpis
          contract={contract}
          summary={summary}
          schedule={schedule}
          currency={currency}
        />

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            {contract.payment_type === 'installment' ? (
              <PaymentSchedule
                contract={contract}
                summary={summary}
                schedule={schedule}
                currency={currency}
                onEdit={canManage ? setEditing : undefined}
              />
            ) : (
              <EnergyPayments schedule={schedule} contract={contract} currency={currency} />
            )}
          </div>
          <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
            <DeviceCard contract={contract} />
            <HistoryCard contractId={contractId} />
          </aside>
        </div>
      </div>

      {panel === 'payment' ? (
        <RecordPaymentSheet
          contract={contract}
          schedule={schedule}
          currency={currency}
          onClose={() => setPanel(null)}
          onRecorded={refresh}
        />
      ) : null}
      {panel === 'plan' ? (
        <ChangePlanSheet
          contract={contract}
          schedule={schedule}
          currency={currency}
          onClose={() => setPanel(null)}
          onChanged={refresh}
        />
      ) : null}
      {panel === 'delete' ? (
        <DeleteContractDialog
          contract={contract}
          onClose={() => setPanel(null)}
          onDeleted={refresh}
        />
      ) : null}
      {editing ? (
        <EditInstallmentDialog
          rate={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      ) : null}
    </>
  );
}

function ContractKpis({
  contract,
  summary,
  schedule,
  currency,
}: {
  contract: Contract;
  summary: ContractSummary;
  schedule: ScheduledRate[];
  currency: string;
}) {
  const money = (value: number) => formatMoney(value, currency);

  if (contract.payment_type === 'energy_service') {
    const lastPayment = schedule.filter((rate) => rate.remaining === 0).at(-1);
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Price per day" value={money(contract.price_per_day ?? 0)} />
        <Kpi label="Minimum payment" value={money(contract.minimum_payable_amount ?? 0)} />
        <Kpi label="Paid" value={money(summary.paidAmount)} />
        <Kpi
          label="Last payment"
          value={lastPayment ? money(lastPayment.rate_cost) : '—'}
          hint={lastPayment ? formatDate(lastPayment.due_date) : 'No payments yet'}
        />
      </div>
    );
  }

  const downPayment = schedule.find((rate) => rate.isDownPayment);
  const downPaymentPaid = downPayment ? downPayment.rate_cost - downPayment.remaining : 0;
  const openRates = schedule.filter((rate) => !rate.isDownPayment && rate.remaining > 0).length;
  const lastRate = schedule.at(-1);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Kpi
        label="Paid"
        value={money(summary.paidAmount)}
        hint={downPaymentPaid > 0 ? `incl. ${money(downPaymentPaid)} down payment` : undefined}
      />
      <Kpi
        label="Remaining"
        value={money(summary.outstanding)}
        hint={`of ${money(contract.total_cost)}`}
      />
      <Kpi
        label="Next installment"
        value={summary.nextRate ? money(summary.nextRate.remaining) : '—'}
        hint={summary.nextRate ? `due ${formatDate(summary.nextRate.due_date)}` : 'Nothing due'}
      />
      {summary.outstanding > 0 ? (
        <Kpi
          label="Paid off by"
          value={formatMonth(lastRate?.due_date)}
          hint={`${openRates} ${openRates === 1 ? 'installment' : 'installments'} to go`}
        />
      ) : (
        <Kpi label="Paid off by" value={summary.totalRates > 0 ? 'Paid off' : '—'} />
      )}
    </div>
  );
}

function PaymentSchedule({
  contract,
  summary,
  schedule,
  currency,
  onEdit,
}: {
  contract: Contract;
  summary: ContractSummary;
  schedule: ScheduledRate[];
  currency: string;
  onEdit?: (rate: ScheduledRate) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { nextRate } = summary;
  const installments = schedule.filter((rate) => !rate.isDownPayment);
  const totalRates = installments.length;
  const paidRates = installments.filter((rate) => rate.remaining <= 0).length;
  const progress = totalRates === 0 ? 0 : Math.round((paidRates / totalRates) * 100);
  const nextIndex = schedule.findIndex((rate) => rate.remaining > 0);
  const collapsedCount = Math.max(COLLAPSED_ROWS, nextIndex + 2);
  const visible = expanded ? schedule : schedule.slice(0, collapsedCount);
  const hidden = schedule.length - visible.length;
  const money = (value: number) => formatMoney(value, currency);
  const editable = (rate: ScheduledRate) => onEdit !== undefined && canEditRate(contract, rate);

  const editButton = (rate: ScheduledRate) => (
    <Button
      variant="outline"
      size="icon"
      className="size-8"
      aria-label={`Edit ${rate.label.toLowerCase()}`}
      onClick={() => onEdit?.(rate)}
    >
      <Pencil />
    </Button>
  );

  return (
    <SectionCard
      title="Payment schedule"
      action={
        <span className="text-sm text-muted-foreground">
          <strong className="text-foreground">
            {paidRates} of {totalRates}
          </strong>{' '}
          installments paid
        </span>
      }
    >
      {schedule.length === 0 ? (
        <EmptyState>This contract has no installments.</EmptyState>
      ) : (
        <>
          <div className="px-4 pt-4 sm:px-6">
            <div
              className="h-2 overflow-hidden rounded-full bg-panel-2"
              role="progressbar"
              aria-label="Installments paid"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-gradient-to-r from-green-bright to-teal"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="hidden sm:block">
            <Table aria-label="Payment schedule">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">#</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Still to pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((rate) => {
                  const pill = ratePill[rateStatus(rate, nextRate)];
                  return (
                    <TableRow key={rate.id}>
                      <TableCell className="pl-6 text-muted-foreground">
                        {rate.isDownPayment ? '—' : rate.label.replace('Installment ', '')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(rate.due_date)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {money(rate.rate_cost)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {rate.remaining > 0 ? money(rate.remaining) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={pill.status}>
                          {rate.isDownPayment
                            ? `Down payment · ${pill.label.toLowerCase()}`
                            : pill.label}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="py-1.5 pr-6 text-right">
                        {editable(rate) ? editButton(rate) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul aria-label="Payment schedule list" className="divide-y divide-border sm:hidden">
            {visible.map((rate) => {
              const pill = ratePill[rateStatus(rate, nextRate)];
              return (
                <li key={rate.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{rate.label}</span>
                      <StatusPill status={pill.status}>{pill.label}</StatusPill>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(rate.due_date)} · {money(rate.rate_cost)}
                      {rate.remaining > 0 && rate.remaining !== rate.rate_cost
                        ? ` · ${money(rate.remaining)} to pay`
                        : ''}
                    </div>
                  </div>
                  {editable(rate) ? editButton(rate) : null}
                </li>
              );
            })}
          </ul>

          {hidden > 0 ? (
            <div className="border-t border-border px-4 py-2 sm:px-6">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
                Show {hidden} more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

function EnergyPayments({
  schedule,
  contract,
  currency,
}: {
  schedule: ScheduledRate[];
  contract: Contract;
  currency: string;
}) {
  const payments = schedule.filter((rate) => rate.remaining === 0).reverse();
  return (
    <SectionCard title="Payments">
      {payments.length === 0 ? (
        <EmptyState>No payments yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border px-4 text-sm sm:px-6">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                {formatDate(payment.due_date)}
                <span className="text-muted-foreground">
                  {' '}
                  · covers {daysCovered(payment.rate_cost, contract.price_per_day)} days
                </span>
              </span>
              <span className="font-semibold whitespace-nowrap">
                {formatMoney(payment.rate_cost, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

const SOLAR_HOME_SYSTEM = 'solar_home_system';

function DeviceCard({ contract }: { contract: Contract }) {
  const device = contract.device;
  const solarHomeSystemId = device?.device_type === SOLAR_HOME_SYSTEM ? device.device_id : null;
  const solarHomeSystem = useQuery({
    queryKey: ['solar-home-system', solarHomeSystemId],
    queryFn: () => fetchSolarHomeSystem(solarHomeSystemId as number),
    enabled: solarHomeSystemId !== null,
  });
  const serial = device?.device_serial ?? contract.device_serial;
  if (!serial) {
    return (
      <SectionCard title="Device">
        <EmptyState>No device is linked to this contract.</EmptyState>
      </SectionCard>
    );
  }

  const lastToken = [...(solarHomeSystem.data?.tokens ?? [])]
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .at(-1);
  const rows: [string, string][] = [
    ['Serial', serial],
    ['Type', device ? sentenceCase(device.device_type) : '—'],
  ];
  if (solarHomeSystem.data) {
    rows.push(['Manufacturer', solarHomeSystem.data.manufacturer?.name ?? '—']);
    rows.push([
      'Last token',
      lastToken
        ? [
            lastToken.token_amount
              ? `${lastToken.token_amount} ${lastToken.token_unit ?? ''}`.trim()
              : null,
            formatDate(lastToken.created_at),
          ]
            .filter(Boolean)
            .join(' · ')
        : 'None yet',
    ]);
  }

  return (
    <SectionCard title="Device">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 px-6 py-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {solarHomeSystem.isError ? (
        <p className="px-6 pb-4 text-xs text-red">
          Could not load the device details: {solarHomeSystem.error.message}
        </p>
      ) : null}
    </SectionCard>
  );
}

const sentenceCase = (value: string) => {
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function HistoryCard({ contractId }: { contractId: number }) {
  const logs = useInfiniteQuery({
    queryKey: ['contract-logs', contractId],
    queryFn: ({ pageParam }) => fetchContractLogs(contractId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.current_page < last.last_page ? last.current_page + 1 : undefined,
  });
  const entries = logs.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <SectionCard title="History">
      {logs.isError ? (
        <p className="px-6 py-4 text-sm text-red">
          Could not load the history: {logs.error.message}
        </p>
      ) : null}
      {logs.isSuccess && entries.length === 0 ? (
        <EmptyState>Nothing has happened yet.</EmptyState>
      ) : null}
      {entries.length > 0 ? (
        <ol className="flex flex-col gap-3 px-6 py-4 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="break-words">{entry.action}</span>
                <span className="text-xs text-muted-foreground">
                  {[formatDate(entry.created_at), entry.owner?.name].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {logs.hasNextPage ? (
        <div className="border-t border-border px-4 py-2 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={logs.isFetchingNextPage}
            onClick={() => void logs.fetchNextPage()}
          >
            {logs.isFetchingNextPage ? 'Loading…' : 'Show older history'}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}
