import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@spark/ui/dropdown-menu';
import { Input } from '@spark/ui/input';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { Tab, Tabs } from '@spark/ui/tabs';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, Download, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { fetchMainSettings } from '@/api/customers';
import {
  countPeople,
  exportCustomers,
  exportDebts,
  fetchAgents,
  fetchCity,
  fetchPeople,
  type DeviceType,
  type ListedPerson,
  type PeopleSort,
} from '@/api/people';
import { can, readSession } from '@/auth/session';
import { Field, selectClass } from '@/components/form';
import { Pagination } from '@/components/Pagination';
import { SearchBox } from '@/components/SearchBox';
import { VillagePicker } from '@/components/VillagePicker';
import { saveFile } from '@/lib/download';
import { formatDate, formatMoney, initials, plural } from '@/lib/format';

import { CustomerForm } from './CustomerForm';
import {
  DEFAULT_PER_PAGE,
  filterKeys,
  peopleQueryOf,
  perPageOptions,
  type CustomerListSearch,
  type FilterKey,
} from './listSearch';
import { standingOf } from './standing';

const deviceLabels: Record<DeviceType, string> = {
  meter: 'Meter',
  solar_home_system: 'Solar home system',
  e_bike: 'E-bike',
};

const statusOptions = [
  [undefined, 'All'],
  ['paying', 'Paying'],
  ['not_paying', 'Not paying'],
] as const;

type SortColumn = 'name' | 'city' | 'device' | 'agent';

function agentName(person: ListedPerson): string | null {
  const agent = person.agent_sold_appliance?.assigned_appliance?.agent?.person;
  return agent ? `${agent.name} ${agent.surname}` : null;
}

function dateRange(from: string | undefined, to: string | undefined): string {
  if (from && to) {
    return `${formatDate(from)} – ${formatDate(to)}`;
  }
  return from ? `from ${formatDate(from)}` : `until ${formatDate(to)}`;
}

function SortableHead({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  sort: PeopleSort;
  onSort: (sort: PeopleSort) => void;
  className?: string;
}) {
  const direction =
    sort === column ? 'ascending' : sort === `-${column}` ? 'descending' : undefined;
  return (
    <TableHead aria-sort={direction ?? 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(direction === 'ascending' ? `-${column}` : column)}
        className="inline-flex cursor-pointer items-center gap-1 font-semibold tracking-wide uppercase hover:text-foreground"
      >
        {label}
        {direction === 'ascending' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : null}
        {direction === 'descending' ? <ArrowDown className="size-3.5" aria-hidden="true" /> : null}
      </button>
    </TableHead>
  );
}

function Avatar({ person, size }: { person: ListedPerson; size: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-lg bg-tile font-semibold text-white ${size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'}`}
    >
      {initials(person.name, person.surname)}
    </span>
  );
}

function LastPayment({ person, currency }: { person: ListedPerson; currency: string }) {
  if (!person.latest_payment) {
    return <span className="text-muted-foreground">No payments</span>;
  }
  return (
    <>
      {formatMoney(person.latest_payment.amount, currency)} ·{' '}
      {formatDate(person.latest_payment.created_at)}
    </>
  );
}

export function CustomerList({ search }: { search: CustomerListSearch }) {
  const navigate = useNavigate({ from: '/customers' });
  const session = readSession();
  const [moreFilters, setMoreFilters] = useState(false);
  const [creating, setCreating] = useState(false);

  const query = peopleQueryOf(search);
  const sort = query.sort_by ?? '-created_at';
  const people = useQuery({
    queryKey: ['people', 'list', query],
    queryFn: () => fetchPeople(query),
    placeholderData: keepPreviousData,
  });
  const customerCount = useQuery({ queryKey: ['people', 'count'], queryFn: () => countPeople() });
  const overdueCount = useQuery({
    queryKey: ['people', 'count', 'overdue'],
    queryFn: () => countPeople({ overdue: 1 }),
  });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const agents = useQuery({ queryKey: ['agents'], queryFn: fetchAgents });
  const village = useQuery({
    queryKey: ['city', search.village],
    queryFn: () => fetchCity(search.village as number),
    enabled: search.village !== undefined,
  });
  const download = useMutation({
    mutationFn: (kind: 'debts' | 'customers') =>
      kind === 'debts' ? exportDebts() : exportCustomers(),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });

  const currency = settings.data?.currency ?? '';

  function update(changes: Partial<CustomerListSearch>, options: { replace?: boolean } = {}) {
    void navigate({
      search: (previous) => ({ ...previous, page: undefined, ...changes }),
      replace: options.replace,
    });
  }

  function clearAll() {
    const cleared = Object.fromEntries(filterKeys.map((key) => [key, undefined]));
    update({ ...cleared, term: undefined });
  }

  const selectedAgent = agents.data?.find((agent) => agent.id === search.agent);
  const chips: { key: string; label: string; remove: Partial<Record<FilterKey, undefined>> }[] = [];
  if (search.status) {
    chips.push({
      key: 'status',
      label: search.status === 'paying' ? 'Paying' : 'Not paying',
      remove: { status: undefined },
    });
  }
  if (search.village !== undefined) {
    chips.push({
      key: 'village',
      label: `Village: ${village.data?.name ?? '…'}`,
      remove: { village: undefined },
    });
  }
  if (search.agent !== undefined) {
    const name = selectedAgent
      ? `${selectedAgent.person.name} ${selectedAgent.person.surname}`
      : '…';
    chips.push({ key: 'agent', label: `Agent: ${name}`, remove: { agent: undefined } });
  }
  if (search.device) {
    chips.push({
      key: 'device',
      label: `Device: ${deviceLabels[search.device]}`,
      remove: { device: undefined },
    });
  }
  if (search.overdue) {
    chips.push({ key: 'overdue', label: 'Overdue only', remove: { overdue: undefined } });
  }
  if (search.paid_from || search.paid_to) {
    chips.push({
      key: 'paid',
      label: `Last payment: ${dateRange(search.paid_from, search.paid_to)}`,
      remove: { paid_from: undefined, paid_to: undefined },
    });
  }
  if (search.registered_from || search.registered_to) {
    chips.push({
      key: 'registered',
      label: `Registered: ${dateRange(search.registered_from, search.registered_to)}`,
      remove: { registered_from: undefined, registered_to: undefined },
    });
  }
  const searching = chips.length > 0 || Boolean(query.term);
  const moreFilterCount = [
    search.device,
    search.overdue,
    search.paid_from ?? search.paid_to,
    search.registered_from ?? search.registered_to,
  ].filter((value) => value !== undefined).length;

  const page = people.data;
  const rows = page?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">Customers</h1>
          {customerCount.data !== undefined && overdueCount.data !== undefined ? (
            <p className="m-0 mt-0.5 text-sm text-muted-foreground">
              {plural(customerCount.data, 'customer')} · {overdueCount.data.toLocaleString('en')}{' '}
              overdue
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {can(session, 'exports') ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10" disabled={download.isPending}>
                  <Download aria-hidden="true" />
                  {download.isPending ? 'Exporting…' : 'Export'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => download.mutate('debts')}>
                  Customers&apos; debts
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => download.mutate('customers')}>
                  All customers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button className="h-10" onClick={() => setCreating(true)}>
            + New customer
          </Button>
        </div>
      </div>

      {download.isError ? (
        <Banner tone="error" role="alert">
          The export failed: {download.error.message}
        </Banner>
      ) : null}

      <Card className="bg-panel">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-4 sm:px-5">
          <SearchBox
            label="Search customers"
            placeholder="Search by name, phone or device serial"
            term={search.term ?? ''}
            onSearch={(term) => update({ term: term.trim() || undefined }, { replace: true })}
          />
          <Tabs
            role="radiogroup"
            aria-label="Payment status"
            className="max-w-full overflow-x-auto"
          >
            {statusOptions.map(([value, label]) => (
              <Tab
                key={label}
                role="radio"
                aria-checked={search.status === value}
                active={search.status === value}
                onClick={() => update({ status: value })}
                className="shrink-0 px-3"
              >
                {label}
              </Tab>
            ))}
          </Tabs>
          <VillagePicker
            label="Village"
            placeholder="Village"
            value={
              search.village !== undefined && village.data
                ? { id: village.data.id, name: village.data.name }
                : null
            }
            onChange={(chosen) => update({ village: chosen?.id })}
            className="w-full sm:w-48"
          />
          <select
            aria-label="Agent"
            className={`${selectClass} h-10 w-full sm:w-48`}
            value={search.agent ?? ''}
            onChange={(event) =>
              update({ agent: event.target.value ? Number(event.target.value) : undefined })
            }
          >
            <option value="">All agents</option>
            {(agents.data ?? []).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.person.name} {agent.person.surname}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            className="h-10"
            aria-expanded={moreFilters}
            aria-controls="more-filters"
            onClick={() => setMoreFilters((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
            More filters{moreFilterCount > 0 ? ` · ${moreFilterCount}` : ''}
          </Button>
        </div>

        {moreFilters ? (
          <div
            id="more-filters"
            className="grid gap-3 border-b border-border px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4"
          >
            <Field label="Device type">
              <select
                className={selectClass}
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
            <label className="flex items-center gap-2.5 self-end pb-2 text-sm font-medium text-label">
              <input
                type="checkbox"
                checked={search.overdue ?? false}
                onChange={(event) => update({ overdue: event.target.checked || undefined })}
                className="size-4 accent-primary"
              />
              Overdue only
            </label>
            <div className="hidden lg:block" />
            <div className="hidden lg:block" />
            {(
              [
                ['paid_from', 'Last payment from'],
                ['paid_to', 'Last payment to'],
                ['registered_from', 'Registered from'],
                ['registered_to', 'Registered to'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="date"
                  value={search[key] ?? ''}
                  onChange={(event) => update({ [key]: event.target.value || undefined })}
                />
              </Field>
            ))}
          </div>
        ) : null}

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-sm sm:px-5">
            <span className="text-muted-foreground">Filtered by</span>
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-1 pr-1 pl-3"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={() => update(chip.remove)}
                  className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-border"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAll} className="cursor-pointer p-1 underline">
              Clear all
            </button>
          </div>
        ) : null}

        {people.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading customers…</p>
        ) : null}
        {people.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load customers: {people.error.message}
            </Banner>
          </div>
        ) : null}
        {page && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            {searching ? (
              <>
                <p className="m-0">No customers match these filters.</p>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              </>
            ) : (
              <p className="m-0">No customers yet.</p>
            )}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Table aria-label="Customers" className="hidden sm:table">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <SortableHead
                    column="name"
                    label="Customer"
                    sort={sort}
                    onSort={(next) => update({ sort: next })}
                    className="pl-5"
                  />
                  <TableHead className="hidden font-semibold lg:table-cell">Phone</TableHead>
                  <SortableHead
                    column="city"
                    label="Village"
                    sort={sort}
                    onSort={(next) => update({ sort: next })}
                    className="hidden md:table-cell"
                  />
                  <SortableHead
                    column="device"
                    label="Devices"
                    sort={sort}
                    onSort={(next) => update({ sort: next })}
                    className="hidden xl:table-cell"
                  />
                  <SortableHead
                    column="agent"
                    label="Agent"
                    sort={sort}
                    onSort={(next) => update({ sort: next })}
                    className="hidden xl:table-cell"
                  />
                  <TableHead className="hidden font-semibold lg:table-cell">Last payment</TableHead>
                  <TableHead className="pr-5 font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((person) => {
                  const standing = standingOf(person);
                  const primary = person.addresses[0];
                  return (
                    <TableRow key={person.id}>
                      <TableCell className="pl-5">
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: person.id }}
                          className="flex items-center gap-2.5 hover:underline"
                        >
                          <Avatar person={person} size="sm" />
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {person.name} {person.surname}
                            </span>
                            <span className="text-xs text-muted-foreground">ID {person.id}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">
                        {primary?.phone || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {primary?.city?.name ?? '—'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {person.devices.slice(0, 2).map((device) => (
                            <span
                              key={device.id}
                              title={device.device_serial}
                              className="max-w-36 truncate rounded-md bg-panel-2 px-2 py-0.5 font-mono text-xs"
                            >
                              {device.device_serial}
                            </span>
                          ))}
                          {person.devices.length > 2 ? (
                            <span className="text-xs text-muted-foreground">
                              +{person.devices.length - 2}
                            </span>
                          ) : null}
                          {person.devices.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {agentName(person) ?? '—'}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">
                        <LastPayment person={person} currency={currency} />
                      </TableCell>
                      <TableCell className="pr-5">
                        <StatusPill status={standing.status} className="whitespace-nowrap">
                          {standing.label}
                        </StatusPill>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <ul aria-label="Customers" className="m-0 flex list-none flex-col gap-2 p-3 sm:hidden">
              {rows.map((person) => {
                const standing = standingOf(person);
                const primary = person.addresses[0];
                return (
                  <li key={person.id}>
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: person.id }}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <Avatar person={person} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <strong className="min-w-0 truncate">
                            {person.name} {person.surname}
                          </strong>
                          <StatusPill
                            status={standing.status}
                            className="shrink-0 whitespace-nowrap"
                          >
                            {standing.label}
                          </StatusPill>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[primary?.phone, primary?.city?.name].filter(Boolean).join(' · ') ||
                            'No contact details'}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {person.latest_payment ? 'Last paid ' : ''}
                          <LastPayment person={person} currency={currency} />
                        </span>
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
            noun="customer"
            perPage={search.per_page ?? DEFAULT_PER_PAGE}
            perPageOptions={perPageOptions}
            onPage={(next) => update({ page: next === 1 ? undefined : next })}
            onPerPage={(size) => update({ per_page: size === DEFAULT_PER_PAGE ? undefined : size })}
          />
        ) : null}
      </Card>

      {creating ? <CustomerForm onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
