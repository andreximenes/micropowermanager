import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { Tab, Tabs } from '@spark/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { AgentAvatar } from './AgentAvatar';
import { AgentForm } from './AgentForm';
import {
  DEFAULT_PER_PAGE,
  filterAgents,
  pageOf,
  perPageOptions,
  type AgentListSearch,
} from './listSearch';

import { fetchAllAgents, primaryPhone, type ListedAgent } from '@/api/agents';
import { fetchMainSettings } from '@/api/customers';
import { can, readSession } from '@/auth/session';
import { Pagination } from '@/components/Pagination';
import { SearchBox } from '@/components/SearchBox';
import { formatMoney, plural } from '@/lib/format';

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="min-w-0 bg-panel px-4 py-3 sm:px-5 sm:py-4">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 truncate text-lg font-bold sm:text-2xl">{value}</p>
      <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Totals({ agents, currency }: { agents: ListedAgent[]; currency: string }) {
  const sites = new Set(agents.flatMap((agent) => (agent.mini_grid ? [agent.mini_grid.id] : [])));
  const active = agents.filter((agent) => agent.is_active).length;
  const customers = agents.reduce((sum, agent) => sum + agent.customer_count, 0);
  const sales = agents.reduce((sum, agent) => sum + agent.sales_count, 0);
  const held = agents.reduce((sum, agent) => sum + agent.balance, 0);
  return (
    <section aria-label="Totals" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
      <Kpi
        label="Agents"
        value={agents.length.toLocaleString('en')}
        hint={`in ${plural(sites.size, 'site')}`}
      />
      <Kpi
        label="Active"
        value={active.toLocaleString('en')}
        hint="sold or collected in the last 30 days"
      />
      <Kpi
        label="Customers served"
        value={customers.toLocaleString('en')}
        hint={`${plural(sales, 'sale')} so far`}
      />
      <Kpi label="Due from agents" value={formatMoney(held, currency)} hint="to hand in" />
    </section>
  );
}

function Status({ agent }: { agent: ListedAgent }) {
  return agent.is_active ? (
    <StatusPill status="success">Active</StatusPill>
  ) : (
    <StatusPill status="neutral">Inactive</StatusPill>
  );
}

function Balance({ agent, currency }: { agent: ListedAgent; currency: string }) {
  return (
    <span className={agent.balance < 0 ? 'text-red' : undefined}>
      {formatMoney(agent.balance, currency)}
    </span>
  );
}

const statusTabs = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export function AgentList({ search }: { search: AgentListSearch }) {
  const navigate = useNavigate({ from: '/agents' });
  const session = readSession();
  const [creating, setCreating] = useState(false);
  const agents = useQuery({ queryKey: ['agents', 'all'], queryFn: fetchAllAgents });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';

  function update(changes: Partial<AgentListSearch>, options: { replace?: boolean } = {}) {
    void navigate({
      search: (previous) => ({ ...previous, page: undefined, ...changes }),
      replace: options.replace,
    });
  }

  const perPage = search.per_page ?? DEFAULT_PER_PAGE;
  const matching = agents.data ? filterAgents(agents.data, search) : [];
  const page = pageOf(matching, search.page ?? 1, perPage);
  const filtered = Boolean(search.term) || search.status !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Agents</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            Field agents who sell kits and collect payments
          </p>
        </div>
        {can(session, 'settings') ? (
          <Button asChild variant="outline" className="h-10">
            <Link to="/agents/commissions">Commission types</Link>
          </Button>
        ) : null}
        <Button className="h-10" onClick={() => setCreating(true)}>
          + New agent
        </Button>
      </div>

      {agents.data ? <Totals agents={agents.data} currency={currency} /> : null}

      <Card className="bg-panel">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-4 sm:px-5">
          <SearchBox
            term={search.term ?? ''}
            onSearch={(term) => update({ term: term.trim() || undefined }, { replace: true })}
            label="Search agents"
            placeholder="Search by name, phone, e-mail or site"
            className="min-w-0 flex-[1_1_240px]"
          />
          <Tabs role="radiogroup" aria-label="Status">
            {statusTabs.map((tab) => (
              <Tab
                key={tab.label}
                role="radio"
                aria-checked={search.status === tab.value}
                active={search.status === tab.value}
                onClick={() => update({ status: tab.value }, { replace: true })}
                className="px-3"
              >
                {tab.label}
              </Tab>
            ))}
          </Tabs>
        </div>

        {agents.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading agents…</p>
        ) : null}
        {agents.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load agents: {agents.error.message}
            </Banner>
          </div>
        ) : null}
        {agents.data && page.total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            {filtered ? (
              <>
                <p className="m-0">No agents match this search.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ term: undefined, status: undefined })}
                >
                  Clear search
                </Button>
              </>
            ) : (
              <p className="m-0">No agents yet. Add the first one.</p>
            )}
          </div>
        ) : null}

        {page.data.length > 0 ? (
          <>
            <Table aria-label="Agents" className="hidden md:table">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Site</TableHead>
                  <TableHead className="text-right font-semibold">Customers</TableHead>
                  <TableHead className="text-right font-semibold">Sales</TableHead>
                  <TableHead className="text-right font-semibold">Balance</TableHead>
                  <TableHead className="pr-5 font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.data.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="pl-5">
                      <Link
                        to="/agents/$agentId"
                        params={{ agentId: agent.id }}
                        className="flex items-center gap-2.5 font-semibold hover:underline"
                      >
                        <AgentAvatar person={agent.person} size="sm" />
                        {agent.person.name} {agent.person.surname}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {primaryPhone(agent) ?? '—'}
                    </TableCell>
                    <TableCell>{agent.mini_grid?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">{agent.customer_count}</TableCell>
                    <TableCell className="text-right">{agent.sales_count}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      <Balance agent={agent} currency={currency} />
                    </TableCell>
                    <TableCell className="pr-5">
                      <Status agent={agent} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <ul aria-label="Agents" className="m-0 flex list-none flex-col gap-2 p-3 md:hidden">
              {page.data.map((agent) => (
                <li key={agent.id}>
                  <Link
                    to="/agents/$agentId"
                    params={{ agentId: agent.id }}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <AgentAvatar person={agent.person} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <strong className="truncate">
                          {agent.person.name} {agent.person.surname}
                        </strong>
                        <Status agent={agent} />
                      </span>
                      <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {[agent.mini_grid?.name, primaryPhone(agent)].filter(Boolean).join(' · ')}
                        </span>
                        <strong className="text-foreground">
                          <Balance agent={agent} currency={currency} />
                        </strong>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {page.total > 0 ? (
          <Pagination
            page={page}
            noun="agent"
            perPage={perPage}
            perPageOptions={perPageOptions}
            onPage={(next) => update({ page: next === 1 ? undefined : next })}
            onPerPage={(size) => update({ per_page: size === DEFAULT_PER_PAGE ? undefined : size })}
          />
        ) : null}
      </Card>

      {creating ? <AgentForm onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
