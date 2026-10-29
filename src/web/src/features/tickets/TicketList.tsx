import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';

import { CategoryDot } from './CategoryDot';
import { ageOf, dueStateOf } from './labels';
import {
  DEFAULT_PER_PAGE,
  filterKeys,
  perPageOptions,
  ticketQueryOf,
  type TicketListSearch,
} from './listSearch';
import { NewTicketSheet } from './NewTicketSheet';
import { TicketDetailPanel } from './TicketDetail';

import {
  countTickets,
  fetchAssignees,
  fetchTicketCategories,
  fetchTickets,
  type Ticket,
} from '@/api/tickets';
import { readSession } from '@/auth/session';
import { selectClass } from '@/components/form';
import { Pagination } from '@/components/Pagination';

const fieldClass = `${selectClass} h-10 w-full`;

function Assignee({ ticket }: { ticket: Ticket }) {
  if (!ticket.assigned_to) {
    return <span className="text-muted-foreground">Unassigned</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {ticket.assigned_to.user_name}
      {ticket.assigned_to.out_source ? (
        <span className="rounded-full bg-panel-2 px-1.5 text-xs text-muted-foreground">
          external
        </span>
      ) : null}
    </span>
  );
}

function Due({ ticket }: { ticket: Ticket }) {
  const due = dueStateOf(ticket);
  return (
    <span
      className={
        due.late ? 'font-semibold text-red' : ticket.due_date ? undefined : 'text-muted-foreground'
      }
    >
      {due.text}
    </span>
  );
}

function customerLine(ticket: Ticket): string {
  const name = ticket.owner ? `${ticket.owner.name} ${ticket.owner.surname}` : 'No customer';
  return `${name} · #${ticket.id}`;
}

export function TicketList({ search }: { search: TicketListSearch }) {
  const navigate = useNavigate({ from: '/tickets' });
  const session = readSession();
  const [creating, setCreating] = useState(false);
  const closed = search.status === 'closed';

  const assignees = useQuery({ queryKey: ['ticket-assignees'], queryFn: fetchAssignees });
  const categories = useQuery({ queryKey: ['ticket-categories'], queryFn: fetchTicketCategories });
  const myTicketUserId = assignees.data?.find((user) => user.userId === session?.user.id)?.id;

  const query = ticketQueryOf(search, myTicketUserId);
  const tickets = useQuery({
    queryKey: ['tickets', 'list', query],
    queryFn: () => fetchTickets(query),
    placeholderData: keepPreviousData,
    // "Assigned to me" means nothing until the user's own ticket user is known.
    enabled: search.assigned !== 'me' || assignees.isSuccess,
  });
  const counts = useQuery({
    queryKey: ['tickets', 'counts'],
    queryFn: async () => {
      const [open, closedCount] = await Promise.all([
        countTickets({ status: 0 }),
        countTickets({ status: 1 }),
      ]);
      return { open, closed: closedCount };
    },
  });

  function update(changes: Partial<TicketListSearch>, options: { replace?: boolean } = {}) {
    void navigate({
      search: (previous) => ({ ...previous, page: undefined, ...changes }),
      replace: options.replace,
    });
  }

  function open(ticketId: number | undefined) {
    void navigate({ search: (previous) => ({ ...previous, ticket: ticketId }) });
  }

  const filtered = filterKeys.some((key) => search[key] !== undefined);
  function clearAll() {
    update(Object.fromEntries(filterKeys.map((key) => [key, undefined])));
  }

  const page = tickets.data;
  const rows = page?.data ?? [];
  const noun = closed ? 'closed ticket' : 'open ticket';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Tickets</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            Customer issues and who is handling them
          </p>
        </div>
        <Button asChild variant="outline" className="h-10">
          <Link to="/tickets/settings">
            <Settings2 aria-hidden="true" />
            Ticket settings
          </Link>
        </Button>
        <Button className="h-10" onClick={() => setCreating(true)}>
          + New ticket
        </Button>
      </div>

      <Card className="bg-panel">
        <div
          role="tablist"
          aria-label="Ticket status"
          className="flex gap-1 border-b border-border px-4 sm:px-5"
        >
          {(['open', 'closed'] as const).map((status) => {
            const active = (search.status ?? 'open') === status;
            const count = counts.data?.[status];
            return (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  update({ status: status === 'open' ? undefined : status, ticket: undefined })
                }
                className={`-mb-px cursor-pointer border-b-2 px-3 py-3 text-sm font-medium ${active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {status === 'open' ? 'Open' : 'Closed'}
                {count !== undefined ? (
                  <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 text-xs">
                    {count.toLocaleString('en')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2.5 border-b border-border px-4 py-4 sm:flex sm:flex-wrap sm:items-end sm:px-5">
          <select
            aria-label="Category"
            className={`${fieldClass} sm:w-52`}
            value={search.category ?? ''}
            onChange={(event) =>
              update({ category: event.target.value ? Number(event.target.value) : undefined })
            }
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.label_name}
              </option>
            ))}
          </select>
          <select
            aria-label="Assigned to"
            className={`${fieldClass} sm:w-52`}
            value={search.assigned ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              update({
                assigned: value === '' || value === 'me' ? value || undefined : Number(value),
              });
            }}
          >
            <option value="">Anyone</option>
            {myTicketUserId !== undefined ? <option value="me">Assigned to me</option> : null}
            {(assignees.data ?? [])
              .filter((user) => user.id !== myTicketUserId)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </div>

        {tickets.isPending && tickets.fetchStatus !== 'idle' ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading tickets…</p>
        ) : null}
        {tickets.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load tickets: {tickets.error.message}
            </Banner>
          </div>
        ) : null}
        {page && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            {filtered ? (
              <>
                <p className="m-0">No {noun}s match these filters.</p>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              </>
            ) : (
              <p className="m-0">
                {closed ? 'No closed tickets yet.' : 'No open tickets. All done.'}
              </p>
            )}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Table aria-label="Tickets" className="hidden sm:table">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold">Ticket</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="hidden font-semibold md:table-cell">Assigned to</TableHead>
                  <TableHead className="font-semibold">Due</TableHead>
                  <TableHead className="pr-5 text-right font-semibold">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    onClick={() => open(ticket.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="pl-5">
                      <Link
                        from="/tickets"
                        to="/tickets"
                        search={(previous) => ({ ...previous, ticket: ticket.id })}
                        className="font-semibold hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {ticket.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {customerLine(ticket)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CategoryDot category={ticket.category} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Assignee ticket={ticket} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Due ticket={ticket} />
                    </TableCell>
                    <TableCell className="pr-5 text-right whitespace-nowrap text-muted-foreground">
                      {ageOf(ticket.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <ul aria-label="Tickets" className="m-0 flex list-none flex-col gap-2 p-3 sm:hidden">
              {rows.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    from="/tickets"
                    to="/tickets"
                    search={(previous) => ({ ...previous, ticket: ticket.id })}
                    className="flex flex-col gap-1 rounded-lg border border-border p-3"
                  >
                    <strong className="min-w-0">{ticket.title}</strong>
                    <span className="text-xs text-muted-foreground">{customerLine(ticket)}</span>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <CategoryDot category={ticket.category} />
                      <Due ticket={ticket} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <Assignee ticket={ticket} /> · {ageOf(ticket.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {page && page.total > 0 ? (
          <Pagination
            page={page}
            noun={noun}
            perPage={search.per_page ?? DEFAULT_PER_PAGE}
            perPageOptions={perPageOptions}
            onPage={(next) => update({ page: next === 1 ? undefined : next })}
            onPerPage={(size) => update({ per_page: size === DEFAULT_PER_PAGE ? undefined : size })}
          />
        ) : null}
      </Card>

      {search.ticket !== undefined ? (
        <TicketDetailPanel ticketId={search.ticket} onClose={() => open(undefined)} />
      ) : null}
      {creating ? (
        <NewTicketSheet
          onClose={() => setCreating(false)}
          onCreated={(ticketId) => {
            setCreating(false);
            open(ticketId);
          }}
        />
      ) : null}
    </div>
  );
}
