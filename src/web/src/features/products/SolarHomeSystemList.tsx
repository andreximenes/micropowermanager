import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import {
  countSolarHomeSystems,
  fetchSolarHomeSystems,
  type ListedSolarHomeSystem,
  type SolarHomeSystemSort,
} from '@/api/solarHomeSystems';
import { selectClass } from '@/components/form';
import { Pagination } from '@/components/Pagination';
import { SearchBox } from '@/components/SearchBox';
import { formatDateTime, plural } from '@/lib/format';

import { AddDevicesSheet } from './AddDevicesSheet';
import {
  DEFAULT_PER_PAGE,
  DEFAULT_SORT,
  perPageOptions,
  solarHomeSystemQueryOf,
  type SolarHomeSystemListSearch,
} from './search';
import { mappingPill, ownerOf, ownershipPill } from './solarHomeSystem';

const sortLabels: Record<SolarHomeSystemSort, string> = {
  '-updated_at': 'Last update, newest',
  '-created_at': 'Added, newest',
  serial_number: 'Serial',
  owner: 'Owner name',
};

function StatusPills({ solarHomeSystem }: { solarHomeSystem: ListedSolarHomeSystem }) {
  const ownership = ownershipPill(solarHomeSystem);
  const mapping = solarHomeSystem.device?.manufacturer_mapping_status;
  return (
    <span className="flex flex-wrap gap-1">
      <StatusPill status={ownership.status} className="whitespace-nowrap">
        {ownership.label}
      </StatusPill>
      {mapping === 'not_mapped' ? (
        <StatusPill status="error" className="whitespace-nowrap">
          {mappingPill.not_mapped.label}
        </StatusPill>
      ) : null}
    </span>
  );
}

function ProductName({ solarHomeSystem }: { solarHomeSystem: ListedSolarHomeSystem }) {
  return solarHomeSystem.appliance ? (
    <>{solarHomeSystem.appliance.name}</>
  ) : (
    <span className="text-muted-foreground">No product</span>
  );
}

export function SolarHomeSystemList({ search }: { search: SolarHomeSystemListSearch }) {
  const navigate = useNavigate({ from: '/solar-home-systems' });
  const [adding, setAdding] = useState(false);
  const query = solarHomeSystemQueryOf(search);
  const list = useQuery({
    queryKey: ['solar-home-systems', 'list', query],
    queryFn: () => fetchSolarHomeSystems(query),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: ['solar-home-systems', 'count'],
    queryFn: countSolarHomeSystems,
  });

  function update(changes: Partial<SolarHomeSystemListSearch>, replace = false) {
    void navigate({
      search: (previous) => ({ ...previous, page: undefined, ...changes }),
      replace,
    });
  }

  const page = list.data;
  const rows = page?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">Solar home systems</h1>
          {counts.data ? (
            <p className="m-0 mt-0.5 text-sm text-muted-foreground">
              {plural(counts.data.total, 'device')} ·{' '}
              {(counts.data.total - counts.data.inStock).toLocaleString('en')} with a customer ·{' '}
              {counts.data.inStock.toLocaleString('en')} in stock
            </p>
          ) : null}
        </div>
        <Button className="h-10" onClick={() => setAdding(true)}>
          + Add devices
        </Button>
      </div>

      <Card className="bg-panel">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-4 sm:px-5">
          <SearchBox
            label="Search solar home systems"
            placeholder="Search by serial or owner name"
            term={search.term ?? ''}
            onSearch={(term) => update({ term: term.trim() || undefined }, true)}
          />
          <label className="flex w-full items-center gap-2 text-sm text-muted-foreground sm:w-auto">
            Sort by
            <select
              className={`${selectClass} h-10 flex-1`}
              value={search.sort ?? DEFAULT_SORT}
              onChange={(event) => {
                const sort = event.target.value as SolarHomeSystemSort;
                update({ sort: sort === DEFAULT_SORT ? undefined : sort });
              }}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {list.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading solar home systems…
          </p>
        ) : null}
        {list.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load solar home systems: {list.error.message}
            </Banner>
          </div>
        ) : null}
        {page && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            {query.term ? (
              <>
                <p className="m-0">No solar home systems match “{query.term}”.</p>
                <Button variant="outline" size="sm" onClick={() => update({ term: undefined })}>
                  Clear search
                </Button>
              </>
            ) : (
              <p className="m-0">No solar home systems yet.</p>
            )}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Table aria-label="Solar home systems" className="hidden md:table">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold">Serial</TableHead>
                  <TableHead className="hidden font-semibold lg:table-cell">Manufacturer</TableHead>
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold">Owner</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="hidden pr-5 font-semibold xl:table-cell">
                    Last update
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((solarHomeSystem) => {
                  const owner = ownerOf(solarHomeSystem);
                  return (
                    <TableRow key={solarHomeSystem.id}>
                      <TableCell className="pl-5">
                        <Link
                          to="/solar-home-systems/$shsId"
                          params={{ shsId: solarHomeSystem.id }}
                          className="tabular-nums font-semibold break-all hover:underline"
                        >
                          {solarHomeSystem.serial_number}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {solarHomeSystem.manufacturer?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <ProductName solarHomeSystem={solarHomeSystem} />
                      </TableCell>
                      <TableCell>
                        {owner ? (
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: owner.id }}
                            className="hover:underline"
                          >
                            {owner.name} {owner.surname}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPills solarHomeSystem={solarHomeSystem} />
                      </TableCell>
                      <TableCell className="hidden pr-5 whitespace-nowrap xl:table-cell">
                        {formatDateTime(solarHomeSystem.updated_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <ul
              aria-label="Solar home systems"
              className="m-0 flex list-none flex-col gap-2 p-3 md:hidden"
            >
              {rows.map((solarHomeSystem) => {
                const owner = ownerOf(solarHomeSystem);
                return (
                  <li key={solarHomeSystem.id}>
                    <Link
                      to="/solar-home-systems/$shsId"
                      params={{ shsId: solarHomeSystem.id }}
                      className="flex flex-col gap-1 rounded-lg border border-border p-3"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <strong className="min-w-0 tabular-nums break-all">
                          {solarHomeSystem.serial_number}
                        </strong>
                        <StatusPills solarHomeSystem={solarHomeSystem} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <ProductName solarHomeSystem={solarHomeSystem} /> ·{' '}
                        {owner ? `${owner.name} ${owner.surname}` : 'No owner'}
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
            noun="device"
            perPage={search.per_page ?? DEFAULT_PER_PAGE}
            perPageOptions={perPageOptions}
            onPage={(next) => update({ page: next === 1 ? undefined : next })}
            onPerPage={(size) => update({ per_page: size === DEFAULT_PER_PAGE ? undefined : size })}
          />
        ) : null}
      </Card>

      {adding ? <AddDevicesSheet onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
