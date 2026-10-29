import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { Tab, Tabs } from '@spark/ui/tabs';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Download, SlidersHorizontal } from 'lucide-react';
import { useState, type MouseEvent } from 'react';

import { TransactionDetailPanel } from './TransactionDetail';
import {
  deviceLabels,
  periodCopy,
  statusFilterLabels,
  transactionStatusOf,
  transactionTypeLabel,
} from './labels';
import {
  DEFAULT_PER_PAGE,
  DEFAULT_PERIOD,
  filterKeys,
  perPageOptions,
  transactionFiltersOf,
  transactionQueryOf,
  type TransactionListSearch,
} from './listSearch';

import { fetchMainSettings } from '@/api/customers';
import type { DeviceType } from '@/api/people';
import {
  analyticsPeriods,
  exportTransactions,
  fetchTransactionAnalytics,
  fetchTransactionProviders,
  fetchTransactions,
  type ListedTransaction,
  type TransactionStatusFilter,
} from '@/api/transactions';
import { can, readSession } from '@/auth/session';
import { FilterChips, type FilterChip } from '@/components/FilterChips';
import { Kpi, KpiChange } from '@/components/Kpi';
import { Field, selectClass } from '@/components/form';
import { Pagination } from '@/components/Pagination';
import { SearchBox } from '@/components/SearchBox';
import { SortableHead } from '@/components/SortableHead';
import { saveFile } from '@/lib/download';
import { formatDate, formatDateTime, formatMoney, paymentChannel } from '@/lib/format';

const fieldClass = `${selectClass} h-10 w-full`;

function dateRange(from: string | undefined, to: string | undefined): string {
  if (from && to) {
    return `${formatDate(from)} – ${formatDate(to)}`;
  }
  return from ? `From ${formatDate(from)}` : `Until ${formatDate(to)}`;
}

function customerName(transaction: ListedTransaction): string | null {
  const person = transaction.device?.person;
  return person ? `${person.name} ${person.surname}` : null;
}

function PeriodSummary({ search }: { search: TransactionListSearch }) {
  const period = search.period ?? DEFAULT_PERIOD;
  const copy = periodCopy[period];
  const analytics = useQuery({
    queryKey: ['transactions', 'analytics', period],
    queryFn: () => fetchTransactionAnalytics(period),
  });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';

  if (analytics.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load the totals: {analytics.error.message}
      </Banner>
    );
  }
  if (!analytics.data) {
    return <p className="m-0 text-sm text-muted-foreground">Loading totals…</p>;
  }
  const { current, past } = analytics.data;
  return (
    <section aria-label="Totals" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
      <Kpi
        label="Received"
        value={current.total.toLocaleString('en')}
        detail={
          <KpiChange
            current={current.total}
            past={past.total}
            changeAs="percent"
            upIsGood
            comparedWith={copy.comparedWith}
          />
        }
      />
      <Kpi
        label="Confirmed"
        value={current.confirmed.toLocaleString('en')}
        detail={
          <KpiChange
            current={current.confirmed}
            past={past.confirmed}
            changeAs="percent"
            upIsGood
            comparedWith={copy.comparedWith}
          />
        }
      />
      <Kpi
        label="Cancelled or rejected"
        value={current.cancelled.toLocaleString('en')}
        detail={
          <KpiChange
            current={current.cancelled}
            past={past.cancelled}
            changeAs="count"
            upIsGood={false}
            comparedWith={copy.comparedWith}
          />
        }
      />
      <Kpi
        label="Revenue"
        value={formatMoney(current.amount, currency)}
        detail={
          <KpiChange
            current={current.amount}
            past={past.amount}
            changeAs="percent"
            upIsGood
            comparedWith={copy.comparedWith}
          />
        }
      />
    </section>
  );
}

function StatusLabel({ transaction }: { transaction: ListedTransaction }) {
  const status = transactionStatusOf(transaction.original_transaction);
  const color = {
    success: 'text-green',
    warning: 'text-amber',
    error: 'text-red',
    neutral: 'text-muted-foreground',
  }[status.tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${color}`}>
      <status.Icon className="size-4" aria-hidden="true" />
      {status.label}
    </span>
  );
}

export function TransactionList({ search }: { search: TransactionListSearch }) {
  const navigate = useNavigate({ from: '/transactions' });
  const session = readSession();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = transactionQueryOf(search);
  const transactions = useQuery({
    queryKey: ['transactions', 'list', query],
    queryFn: () => fetchTransactions(query),
    placeholderData: keepPreviousData,
  });
  const providers = useQuery({
    queryKey: ['transaction-providers'],
    queryFn: fetchTransactionProviders,
  });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const download = useMutation({
    mutationFn: () => exportTransactions(transactionFiltersOf(search)),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });

  const currency = settings.data?.currency ?? '';
  const period = search.period ?? DEFAULT_PERIOD;
  const linksToCustomers = can(session, 'customers');

  function update(changes: Partial<TransactionListSearch>, options: { replace?: boolean } = {}) {
    void navigate({
      search: (previous) => ({ ...previous, page: undefined, ...changes }),
      replace: options.replace,
    });
  }

  function open(transactionId: number | undefined) {
    void navigate({ search: (previous) => ({ ...previous, transaction: transactionId }) });
  }

  function clearAll() {
    update(Object.fromEntries(filterKeys.map((key) => [key, undefined])));
  }

  const chips: FilterChip[] = [];
  if (search.serial) {
    chips.push({
      key: 'serial',
      label: `Serial: ${search.serial}`,
      onRemove: () => update({ serial: undefined }),
    });
  }
  if (search.status) {
    chips.push({
      key: 'status',
      label: statusFilterLabels[search.status],
      onRemove: () => update({ status: undefined }),
    });
  }
  if (search.provider) {
    chips.push({
      key: 'provider',
      label: `Provider: ${paymentChannel(search.provider)}`,
      onRemove: () => update({ provider: undefined }),
    });
  }
  if (search.device) {
    chips.push({
      key: 'device',
      label: `Device: ${deviceLabels[search.device]}`,
      onRemove: () => update({ device: undefined }),
    });
  }
  if (search.from || search.to) {
    chips.push({
      key: 'dates',
      label: dateRange(search.from, search.to),
      onRemove: () => update({ from: undefined, to: undefined }),
    });
  }

  const providerOptions = [...(providers.data ?? [])];
  if (search.provider && !providerOptions.includes(search.provider)) {
    providerOptions.push(search.provider);
  }

  const page = transactions.data;
  const rows = page?.data ?? [];

  // The row opens the transaction; links inside it (the customer) keep their own target.
  function openFromRow(event: MouseEvent<HTMLTableRowElement>, transactionId: number) {
    if (!(event.target as HTMLElement).closest('a')) {
      open(transactionId);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Transactions</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">{periodCopy[period].summary}</p>
        </div>
        <Tabs
          role="radiogroup"
          aria-label="Period"
          className="order-last max-w-full overflow-x-auto md:order-none"
        >
          {analyticsPeriods.map((value) => (
            <Tab
              key={value}
              role="radio"
              aria-checked={period === value}
              active={period === value}
              onClick={() =>
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    period: value === DEFAULT_PERIOD ? undefined : value,
                  }),
                  replace: true,
                })
              }
              className="shrink-0 px-3"
            >
              {periodCopy[value].label}
            </Tab>
          ))}
        </Tabs>
        {can(session, 'exports') ? (
          <Button
            variant="outline"
            className="h-10"
            aria-label="Export CSV"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            <Download aria-hidden="true" />
            <span className="hidden sm:inline">
              {download.isPending ? 'Exporting…' : 'Export CSV'}
            </span>
          </Button>
        ) : null}
      </div>

      {download.isError ? (
        <Banner tone="error" role="alert">
          The export failed: {download.error.message}
        </Banner>
      ) : null}

      <PeriodSummary search={search} />

      <Card className="bg-panel">
        <div className="flex flex-wrap items-end gap-2.5 border-b border-border px-4 py-4 sm:px-5">
          <SearchBox
            term={search.serial ?? ''}
            onSearch={(term) => update({ serial: term.trim() || undefined }, { replace: true })}
            label="Device serial"
            placeholder="Search by device serial"
            className="min-w-0 flex-[1_1_180px]"
          />
          <Button
            variant="outline"
            className="h-10 sm:hidden"
            aria-expanded={filtersOpen}
            aria-controls="transaction-filters"
            onClick={() => setFiltersOpen((isOpen) => !isOpen)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters{chips.length > 0 ? ` · ${chips.length}` : ''}
          </Button>
          <div
            id="transaction-filters"
            className={`${filtersOpen ? 'grid' : 'hidden'} w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-end`}
          >
            <Field label="Status" className="sm:w-36">
              <select
                className={fieldClass}
                value={search.status ?? ''}
                onChange={(event) =>
                  update({
                    status: (event.target.value || undefined) as
                      TransactionStatusFilter | undefined,
                  })
                }
              >
                <option value="">Any status</option>
                {Object.entries(statusFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Provider" className="sm:w-40">
              <select
                className={fieldClass}
                value={search.provider ?? ''}
                onChange={(event) => update({ provider: event.target.value || undefined })}
              >
                <option value="">Any provider</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {paymentChannel(provider)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Device type" className="col-span-2 sm:w-44">
              <select
                className={fieldClass}
                value={search.device ?? ''}
                onChange={(event) =>
                  update({ device: (event.target.value || undefined) as DeviceType | undefined })
                }
              >
                <option value="">Any device</option>
                {Object.entries(deviceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From" className="sm:w-40">
              <input
                type="date"
                className={fieldClass}
                value={search.from ?? ''}
                max={search.to}
                onChange={(event) => update({ from: event.target.value || undefined })}
              />
            </Field>
            <Field label="To" className="sm:w-40">
              <input
                type="date"
                className={fieldClass}
                value={search.to ?? ''}
                min={search.from}
                onChange={(event) => update({ to: event.target.value || undefined })}
              />
            </Field>
          </div>
        </div>

        <FilterChips chips={chips} onClearAll={clearAll} />

        {transactions.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading transactions…
          </p>
        ) : null}
        {transactions.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load transactions: {transactions.error.message}
            </Banner>
          </div>
        ) : null}
        {page && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            {chips.length > 0 ? (
              <>
                <p className="m-0">No transactions match these filters.</p>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              </>
            ) : (
              <p className="m-0">No transactions yet.</p>
            )}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Table aria-label="Transactions" className="hidden sm:table">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold">Status</TableHead>
                  <SortableHead
                    column="original_transaction_type"
                    label="Provider"
                    sort={query.sort_by}
                    onSort={(sort) => update({ sort })}
                  />
                  <SortableHead
                    column="sender"
                    label="Sender"
                    sort={query.sort_by}
                    onSort={(sort) => update({ sort })}
                    className="hidden lg:table-cell"
                  />
                  <TableHead className="font-semibold">Customer</TableHead>
                  <SortableHead
                    column="amount"
                    label="Amount"
                    sort={query.sort_by}
                    onSort={(sort) => update({ sort })}
                    className="text-right"
                  />
                  <TableHead className="hidden font-semibold md:table-cell">Type</TableHead>
                  <SortableHead
                    column="created_at"
                    label="Date"
                    sort={query.sort_by}
                    onSort={(sort) => update({ sort })}
                    className="pr-5"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((transaction) => {
                  const name = customerName(transaction);
                  const person = transaction.device?.person;
                  return (
                    <TableRow
                      key={transaction.id}
                      onClick={(event) => openFromRow(event, transaction.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="pl-5">
                        <StatusLabel transaction={transaction} />
                      </TableCell>
                      <TableCell>{paymentChannel(transaction.original_transaction_type)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">
                        {transaction.sender ?? '—'}
                      </TableCell>
                      <TableCell>
                        {person && linksToCustomers ? (
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: person.id }}
                            className="underline-offset-2 hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className={name ? undefined : 'text-muted-foreground'}>
                            {name ?? 'Unknown sender'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatMoney(transaction.amount, currency)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {transactionTypeLabel(transaction.type)}
                      </TableCell>
                      <TableCell className="pr-5 whitespace-nowrap text-muted-foreground">
                        <Link
                          from="/transactions"
                          to="/transactions"
                          search={(previous) => ({ ...previous, transaction: transaction.id })}
                          aria-label={`Open transaction ${transaction.id}`}
                          className="hover:text-foreground"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {formatDateTime(transaction.created_at)}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <ul
              aria-label="Transactions"
              className="m-0 flex list-none flex-col gap-2 p-3 sm:hidden"
            >
              {rows.map((transaction) => {
                const name = customerName(transaction);
                return (
                  <li key={transaction.id}>
                    <Link
                      from="/transactions"
                      to="/transactions"
                      search={(previous) => ({ ...previous, transaction: transaction.id })}
                      className="flex flex-col gap-1 rounded-lg border border-border p-3"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <strong
                          className={`min-w-0 truncate ${name ? '' : 'text-muted-foreground'}`}
                        >
                          {name ?? 'Unknown sender'}
                        </strong>
                        <strong className="shrink-0">
                          {formatMoney(transaction.amount, currency)}
                        </strong>
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {[
                            transactionTypeLabel(transaction.type),
                            paymentChannel(transaction.original_transaction_type),
                            formatDateTime(transaction.created_at),
                          ].join(' · ')}
                        </span>
                        <StatusLabel transaction={transaction} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {page && page.total > 0 ? (
          <Pagination
            page={page}
            noun="transaction"
            perPage={search.per_page ?? DEFAULT_PER_PAGE}
            perPageOptions={perPageOptions}
            onPage={(next) => update({ page: next === 1 ? undefined : next })}
            onPerPage={(size) => update({ per_page: size === DEFAULT_PER_PAGE ? undefined : size })}
          />
        ) : null}
      </Card>

      {search.transaction !== undefined ? (
        <TransactionDetailPanel
          transactionId={search.transaction}
          currency={currency}
          onClose={() => open(undefined)}
        />
      ) : null}
    </div>
  );
}
