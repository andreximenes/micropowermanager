import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { agentTabLabels, balanceEntryLabel, type AgentTab } from './labels';

import {
  assignProduct,
  fetchAgentTickets,
  fetchAgentTransactions,
  fetchAssignedProducts,
  fetchBalanceHistory,
  fetchReceipts,
  fetchSoldProducts,
  unassignProduct,
  type Agent,
} from '@/api/agents';
import { fetchAppliances } from '@/api/products';
import { can, readSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field, selectClass } from '@/components/form';
import { Pagination } from '@/components/Pagination';
import { formatDate, formatDateTime, formatMoney, sentenceCase } from '@/lib/format';

const PER_PAGE = 15;

type Page<Row> = {
  data: Row[];
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type Column<Row> = {
  label: string;
  cell: (row: Row) => ReactNode;
  align?: 'right';
};

/** One page of an agent's records, with its own pager, loaded when the tab opens. */
function PagedTable<Row extends { id: number }>({
  label,
  noun,
  queryKey,
  load,
  columns,
  empty,
}: {
  label: string;
  noun: string;
  queryKey: unknown[];
  load: (page: number) => Promise<Page<Row>>;
  columns: Column<Row>[];
  empty: string;
}) {
  const [page, setPage] = useState(1);
  const result = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => load(page),
    placeholderData: keepPreviousData,
  });

  if (result.isPending) {
    return <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (result.isError) {
    return (
      <div className="p-4">
        <Banner tone="error" role="alert">
          Could not load {noun}s: {result.error.message}
        </Banner>
      </div>
    );
  }
  if (result.data.total === 0) {
    return <p className="px-6 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <div className="overflow-x-auto">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
              {columns.map((column, index) => (
                <TableHead
                  key={column.label}
                  className={`font-semibold ${column.align === 'right' ? 'text-right' : ''} ${index === 0 ? 'pl-5' : ''} ${index === columns.length - 1 ? 'pr-5' : ''}`}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.data.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column, index) => (
                  <TableCell
                    key={column.label}
                    className={`${column.align === 'right' ? 'text-right whitespace-nowrap' : ''} ${index === 0 ? 'pl-5' : ''} ${index === columns.length - 1 ? 'pr-5' : ''}`}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.data.last_page > 1 ? (
        <Pagination
          page={result.data}
          noun={noun}
          perPage={PER_PAGE}
          perPageOptions={[PER_PAGE]}
          onPage={setPage}
          onPerPage={() => undefined}
        />
      ) : null}
    </>
  );
}

function CustomerLink({
  person,
}: {
  person: { id: number; name: string; surname: string } | null;
}) {
  if (!person) {
    return <span className="text-muted-foreground">—</span>;
  }
  const name = `${person.name} ${person.surname}`;
  return can(readSession(), 'customers') ? (
    <Link
      to="/customers/$customerId"
      params={{ customerId: person.id }}
      className="hover:underline"
    >
      {name}
    </Link>
  ) : (
    name
  );
}

function AssignForm({ agent, currency }: { agent: Agent; currency: string }) {
  const queryClient = useQueryClient();
  const session = readSession();
  const products = useQuery({ queryKey: ['appliances'], queryFn: fetchAppliances });
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const assign = useMutation({
    mutationFn: () =>
      assignProduct(agent.id, session?.user.id ?? 0, Number(productId), Number(price)),
    onSuccess: async () => {
      setProductId('');
      setPrice('');
      await queryClient.invalidateQueries({ queryKey: ['agent', agent.id, 'assigned'] });
    },
  });
  const validPrice = /^\d+(\.\d{1,2})?$/.test(price);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (productId && validPrice) {
      assign.mutate();
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Assign a product"
      className="flex flex-col gap-3 border-t border-border bg-panel-2/50 px-4 py-4 sm:px-5"
    >
      {assign.isError ? (
        <Banner tone="error" role="alert">
          The product was not assigned: {assign.error.message}
        </Banner>
      ) : null}
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <Field label="Assign a product" className="col-span-2 sm:col-span-1">
          <select
            className={`${selectClass} h-10`}
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              const product = products.data?.find(
                (candidate) => String(candidate.id) === event.target.value,
              );
              setPrice(product ? String(product.price) : '');
            }}
          >
            <option value="">Choose a product</option>
            {(products.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Agent price (${currency})`}>
          <input
            inputMode="decimal"
            className={`${selectClass} h-10`}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-invalid={price !== '' && !validPrice}
          />
        </Field>
        <Button
          type="submit"
          className="h-10"
          disabled={!productId || !validPrice || assign.isPending}
        >
          {assign.isPending ? 'Assigning…' : 'Assign'}
        </Button>
      </div>
    </form>
  );
}

function AssignedProducts({ agent, currency }: { agent: Agent; currency: string }) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const share = agent.commission?.appliance_commission ?? 0;
  return (
    <>
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="m-0 text-base font-semibold">Products this agent can sell</h2>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          The agent app offers these at the agent price.
          {share > 0 ? ` The agent earns ${Math.round(share * 1000) / 10}% of each sale.` : ''}
        </p>
      </div>
      <PagedTable
        label="Assigned products"
        noun="product"
        queryKey={['agent', agent.id, 'assigned']}
        load={(page) => fetchAssignedProducts(agent.id, page)}
        empty="No products assigned yet."
        columns={[
          { label: 'Product', cell: (row) => <strong>{row.appliance?.name ?? '—'}</strong> },
          { label: 'Agent price', align: 'right', cell: (row) => formatMoney(row.cost, currency) },
          {
            label: 'Commission',
            align: 'right',
            cell: (row) =>
              share > 0 ? `${formatMoney(row.cost * share, currency)} per sale` : '—',
          },
          { label: 'Assigned', cell: (row) => formatDate(row.created_at) },
          {
            label: 'Actions',
            align: 'right',
            cell: (row) => (
              <Button
                variant="outline"
                size="icon"
                className="text-red"
                aria-label={`Remove ${row.appliance?.name ?? 'product'}`}
                onClick={() => setRemoving({ id: row.id, name: row.appliance?.name ?? 'product' })}
              >
                <Trash2 />
              </Button>
            ),
          },
        ]}
      />
      <AssignForm agent={agent} currency={currency} />
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          description="The agent app stops offering it. Sales already made are kept."
          confirmLabel="Remove product"
          pendingLabel="Removing…"
          failureLabel="The product was not removed"
          onConfirm={() => unassignProduct(removing.id)}
          onDone={() =>
            queryClient.invalidateQueries({ queryKey: ['agent', agent.id, 'assigned'] })
          }
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}

export function AgentTabContent({
  tab,
  agent,
  currency,
}: {
  tab: AgentTab;
  agent: Agent;
  currency: string;
}) {
  const money = (value: number) => formatMoney(value, currency);
  switch (tab) {
    case 'assigned':
      return <AssignedProducts agent={agent} currency={currency} />;
    case 'sold':
      return (
        <PagedTable
          label="Sold products"
          noun="sale"
          queryKey={['agent', agent.id, 'sold']}
          load={(page) => fetchSoldProducts(agent.id, page)}
          empty="No sales yet."
          columns={[
            { label: 'Product', cell: (row) => <strong>{row.appliance?.name ?? '—'}</strong> },
            { label: 'Customer', cell: (row) => <CustomerLink person={row.person} /> },
            { label: 'Price', align: 'right', cell: (row) => money(row.total_cost) },
            {
              label: 'Contract',
              cell: (row) =>
                can(readSession(), 'customers') ? (
                  <Link
                    to="/contracts/$contractId"
                    params={{ contractId: row.id }}
                    className="hover:underline"
                  >
                    Contract #{row.id}
                  </Link>
                ) : (
                  `#${row.id}`
                ),
            },
            { label: 'Sold', cell: (row) => formatDate(row.created_at) },
          ]}
        />
      );
    case 'receipts':
      return (
        <PagedTable
          label="Receipts"
          noun="receipt"
          queryKey={['agent', agent.id, 'receipts']}
          load={(page) => fetchReceipts(agent.id, page)}
          empty="The agent has not handed in any money yet."
          columns={[
            { label: 'Date', cell: (row) => formatDateTime(row.created_at) },
            { label: 'Received by', cell: (row) => row.user?.name ?? '—' },
            { label: 'Amount', align: 'right', cell: (row) => money(row.amount) },
          ]}
        />
      );
    case 'balance':
    case 'commission':
      return (
        <PagedTable
          label={agentTabLabels[tab]}
          noun="entry"
          queryKey={['agent', agent.id, tab]}
          load={(page) => fetchBalanceHistory(agent.id, tab, page)}
          empty={tab === 'balance' ? 'No balance changes yet.' : 'No commission earned yet.'}
          columns={[
            { label: 'Date', cell: (row) => formatDateTime(row.created_at) },
            { label: 'What', cell: (row) => balanceEntryLabel(row.trigger_type) },
            {
              label: 'Change',
              align: 'right',
              cell: (row) => (
                <span className={row.amount < 0 ? 'text-red' : 'text-green'}>
                  {row.amount > 0 ? '+' : ''}
                  {money(row.amount)}
                </span>
              ),
            },
            { label: 'After', align: 'right', cell: (row) => money(row.available_balance) },
          ]}
        />
      );
    case 'transactions':
      return (
        <PagedTable
          label="Transactions"
          noun="transaction"
          queryKey={['agent', agent.id, 'transactions']}
          load={(page) => fetchAgentTransactions(agent.id, page)}
          empty="The agent has not collected any payment yet."
          columns={[
            { label: 'Date', cell: (row) => formatDateTime(row.created_at) },
            {
              label: 'Customer',
              cell: (row) => <CustomerLink person={row.device?.person ?? null} />,
            },
            { label: 'Type', cell: (row) => (row.type ? sentenceCase(row.type) : '—') },
            { label: 'Amount', align: 'right', cell: (row) => money(row.amount) },
          ]}
        />
      );
    case 'tickets':
      return (
        <PagedTable
          label="Tickets"
          noun="ticket"
          queryKey={['agent', agent.id, 'tickets']}
          load={(page) => fetchAgentTickets(agent.id, page)}
          empty="The agent has not opened any ticket."
          columns={[
            {
              label: 'Ticket',
              cell: (row) => (
                <Link
                  to="/tickets"
                  search={{ ticket: row.id, status: row.status === 1 ? 'closed' : undefined }}
                  className="font-semibold hover:underline"
                >
                  {row.title}
                </Link>
              ),
            },
            { label: 'Customer', cell: (row) => <CustomerLink person={row.owner} /> },
            { label: 'Opened', cell: (row) => formatDate(row.created_at) },
            {
              label: 'Status',
              cell: (row) =>
                row.status === 0 ? (
                  <StatusPill status="warning">Open</StatusPill>
                ) : (
                  <StatusPill status="neutral">Closed</StatusPill>
                ),
            },
          ]}
        />
      );
  }
}
