import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@spark/ui/dropdown-menu';
import { StatusPill } from '@spark/ui/status-pill';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { AgentAvatar } from './AgentAvatar';
import { AgentForm } from './AgentForm';
import { AgentMoneySheet, AgentPasswordSheet } from './AgentSheets';
import { AgentTabContent } from './AgentTabs';
import { agentTabLabels, agentTabs, balanceEntryLabel, type AgentTab } from './labels';

import {
  deleteAgent,
  fetchAgent,
  fetchAllAgents,
  fetchBalanceHistory,
  primaryPhone,
  type Agent,
} from '@/api/agents';
import { fetchMainSettings } from '@/api/customers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDate, formatMonth, formatMoney } from '@/lib/format';

type Panel = 'edit' | 'balance' | 'receipt' | 'password' | 'delete';

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="bg-panel">
      <h2 className="m-0 border-b border-border px-5 py-4 text-base font-semibold">{title}</h2>
      <div className="px-5 py-4 text-sm">{children}</div>
    </Card>
  );
}

function LatestBalanceChanges({ agent, currency }: { agent: Agent; currency: string }) {
  const history = useQuery({
    queryKey: ['agent', agent.id, 'balance', 'latest'],
    queryFn: () => fetchBalanceHistory(agent.id, 'balance', 1, 5),
  });
  if (history.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load balance changes: {history.error.message}
      </Banner>
    );
  }
  const entries = history.data?.data ?? [];
  if (history.data && entries.length === 0) {
    return <p className="m-0 text-muted-foreground">No balance changes yet.</p>;
  }
  return (
    <ul aria-label="Latest balance changes" className="m-0 flex list-none flex-col gap-3 p-0">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start justify-between gap-3">
          <span>
            {balanceEntryLabel(entry.trigger_type)}
            <span className="block text-xs text-muted-foreground">
              {formatDate(entry.created_at)}
            </span>
          </span>
          <strong className={`whitespace-nowrap ${entry.amount < 0 ? 'text-red' : ''}`}>
            {entry.amount > 0 ? '+' : ''}
            {formatMoney(entry.amount, currency)}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function CommissionCard({ agent }: { agent: Agent }) {
  const commission = agent.commission;
  if (!commission) {
    return <p className="m-0 text-muted-foreground">No commission type set.</p>;
  }
  const percent = (share: number) => `${Math.round(share * 1000) / 10}%`;
  return (
    <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
      <dt className="text-muted-foreground">Type</dt>
      <dd className="m-0 text-right font-semibold">{commission.name}</dd>
      <dt className="text-muted-foreground">On energy payments</dt>
      <dd className="m-0 text-right">{percent(commission.energy_commission)}</dd>
      <dt className="text-muted-foreground">On product sales</dt>
      <dd className="m-0 text-right">{percent(commission.appliance_commission)}</dd>
    </dl>
  );
}

export function AgentDetail({ agentId, tab }: { agentId: number; tab: AgentTab }) {
  const navigate = useNavigate({ from: '/agents/$agentId' });
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel | null>(null);
  const agent = useQuery({ queryKey: ['agent', agentId], queryFn: () => fetchAgent(agentId) });
  // The list carries what the detail endpoint leaves out: activity and the counts.
  const listed = useQuery({ queryKey: ['agents', 'all'], queryFn: fetchAllAgents });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';

  if (agent.isPending) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading agent…</p>;
  }
  if (agent.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load this agent: {agent.error.message}
      </Banner>
    );
  }

  const data = agent.data;
  const summary = listed.data?.find((candidate) => candidate.id === agentId);
  const fullName = `${data.person.name} ${data.person.surname}`;
  const phone = primaryPhone(data);
  const counts: Partial<Record<AgentTab, number>> = { sold: summary?.sales_count };

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/agents" className="hover:underline">
          Agents
        </Link>{' '}
        / {fullName}
      </nav>

      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel p-4 shadow-sm sm:gap-5 sm:p-6">
        <AgentAvatar person={data.person} size="lg" />
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-xl font-bold sm:text-2xl">{fullName}</h1>
            {summary ? (
              <StatusPill status={summary.is_active ? 'success' : 'neutral'}>
                {summary.is_active ? 'Active' : 'Inactive'}
              </StatusPill>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {phone ? <span>{phone}</span> : null}
            {data.mini_grid ? <span>{data.mini_grid.name}</span> : null}
            <span>{data.email}</span>
            <span>Agent since {formatMonth(data.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="m-0 text-xs text-muted-foreground">Due to the company</p>
            <p className={`m-0 text-xl font-bold ${data.balance < 0 ? 'text-red' : ''}`}>
              {formatMoney(data.balance, currency)}
            </p>
          </div>
          <div>
            <p className="m-0 text-xs text-muted-foreground">Pending commission</p>
            <p className="m-0 text-xl font-bold">
              {formatMoney(data.commission_revenue, currency)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPanel('edit')}>
            Edit
          </Button>
          <Button variant="outline" onClick={() => setPanel('balance')}>
            Add balance
          </Button>
          <Button onClick={() => setPanel('receipt')}>Add receipt</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPanel('password')}>
                Change password
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPanel('delete')} className="text-red">
                Delete agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <nav
        aria-label="Agent sections"
        className="flex max-w-full gap-1 overflow-x-auto border-b border-border"
      >
        {agentTabs.map((name) => (
          <Link
            key={name}
            from="/agents/$agentId"
            to="/agents/$agentId"
            search={{ tab: name === 'assigned' ? undefined : name }}
            replace
            aria-current={tab === name ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${tab === name ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {agentTabLabels[name]}
            {counts[name] ? (
              <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 text-xs">{counts[name]}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_520px] bg-panel">
          {/* Keyed so a tab never shows the previous tab's rows while its own load. */}
          <AgentTabContent key={tab} tab={tab} agent={data} currency={currency} />
        </Card>
        <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-5">
          <SideCard title="Latest balance changes">
            <LatestBalanceChanges agent={data} currency={currency} />
          </SideCard>
          <SideCard title="Commission">
            <CommissionCard agent={data} />
          </SideCard>
        </aside>
      </div>

      {panel === 'edit' ? <AgentForm agent={data} onClose={() => setPanel(null)} /> : null}
      {panel === 'balance' || panel === 'receipt' ? (
        <AgentMoneySheet
          agent={data}
          kind={panel}
          currency={currency}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel === 'password' ? (
        <AgentPasswordSheet agent={data} onClose={() => setPanel(null)} />
      ) : null}
      {panel === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${fullName}?`}
          description="The agent is removed and can no longer sign in to the agent app. This cannot be undone."
          confirmLabel="Delete agent"
          pendingLabel="Deleting…"
          failureLabel="The agent was not deleted"
          onConfirm={() => deleteAgent(data.id)}
          onDone={async () => {
            queryClient.removeQueries({ queryKey: ['agent', data.id] });
            await queryClient.invalidateQueries({ queryKey: ['agents'] });
            await navigate({ to: '/agents' });
          }}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
