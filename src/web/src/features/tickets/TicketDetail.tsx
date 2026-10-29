import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { StatusPill } from '@spark/ui/status-pill';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { CategoryDot } from './CategoryDot';
import { assigneeLabel, daysUntil } from './labels';

import { addComment, closeTicket, fetchTicket, type Ticket } from '@/api/tickets';
import { can, readSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Step } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { formatDate, formatDateTime, initials } from '@/lib/format';

function statusOf(ticket: Ticket): { tone: 'error' | 'warning' | 'neutral'; label: string } {
  if (ticket.status !== 0) {
    return { tone: 'neutral', label: 'Closed' };
  }
  const daysLeft = ticket.due_date ? daysUntil(ticket.due_date) : null;
  if (daysLeft !== null && daysLeft < 0) {
    const late = -daysLeft;
    return { tone: 'error', label: `Open · ${late} ${late === 1 ? 'day' : 'days'} late` };
  }
  return { tone: 'warning', label: 'Open' };
}

function commenterInitials(name: string): string {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return initials(first, second);
}

function Comments({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [draft, setDraft] = useState('');
  const post = useMutation({
    mutationFn: (comment: string) => addComment(ticket.id, comment),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) {
      post.mutate(draft.trim());
    }
  }

  return (
    <Step title={`Comments · ${ticket.comments.length}`}>
      {ticket.comments.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol aria-label="Comments" className="m-0 flex list-none flex-col gap-3 p-0">
          {ticket.comments.map((comment) => {
            const author = comment.ticket_user?.user_name ?? 'Unknown';
            return (
              <li key={comment.id} className="flex gap-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-tile text-xs font-semibold text-white"
                  aria-hidden="true"
                >
                  {commenterInitials(author)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-panel-2 px-3 py-2 text-sm">
                  <span className="flex flex-wrap justify-between gap-2">
                    <strong>{author}</strong>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(comment.created_at)}
                    </span>
                  </span>
                  <span className="break-words whitespace-pre-line">{comment.comment}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        {post.isError ? (
          <Banner tone="error" role="alert">
            The comment was not posted: {post.error.message}
          </Banner>
        ) : null}
        <label htmlFor={fieldId} className="text-sm font-medium text-label">
          Add a comment
        </label>
        <textarea
          id={fieldId}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write what happened or what's next"
          className="rounded-md border border-input-border bg-input px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <Button
          type="submit"
          variant="outline"
          className="self-end"
          disabled={post.isPending || !draft.trim()}
        >
          {post.isPending ? 'Posting…' : 'Post comment'}
        </Button>
      </form>
    </Step>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-label">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function TicketBody({ ticket }: { ticket: Ticket }) {
  const session = readSession();
  const owner = ticket.owner;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Detail label="Customer">
          {!owner ? (
            <span className="text-muted-foreground">No customer</span>
          ) : can(session, 'customers') ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: owner.id }}
              className="font-semibold underline"
            >
              {owner.name} {owner.surname}
            </Link>
          ) : (
            `${owner.name} ${owner.surname}`
          )}
        </Detail>
        <Detail label="Category">
          <CategoryDot category={ticket.category} />
        </Detail>
        <Detail label="Assigned to">{assigneeLabel(ticket)}</Detail>
        <Detail label="Due date">{formatDate(ticket.due_date)}</Detail>
      </div>

      <Step title="Description">
        <p className="m-0 text-sm break-words whitespace-pre-line">
          {ticket.content || <span className="text-muted-foreground">No description.</span>}
        </p>
      </Step>

      <Comments ticket={ticket} />
    </>
  );
}

/** One ticket, opened over the list it was picked from. */
export function TicketDetailPanel({
  ticketId,
  onClose,
}: {
  ticketId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const ticket = useQuery({
    queryKey: ['tickets', 'detail', ticketId],
    queryFn: () => fetchTicket(ticketId),
  });
  const data = ticket.data;
  const status = data ? statusOf(data) : null;

  return (
    <>
      <Sheet
        title={
          data && status ? (
            <span className="flex flex-wrap items-center gap-3">
              {data.title} <StatusPill status={status.tone}>{status.label}</StatusPill>
            </span>
          ) : (
            `Ticket #${ticketId}`
          )
        }
        description={
          data ? `Ticket #${data.id} · opened ${formatDate(data.created_at)}` : undefined
        }
        onClose={onClose}
        footer={
          data?.status === 0 ? (
            <>
              <Button variant="outline" onClick={onClose} className="ml-auto">
                Done
              </Button>
              <Button onClick={() => setClosing(true)}>Close ticket</Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} className="ml-auto">
              Done
            </Button>
          )
        }
      >
        {ticket.isPending ? (
          <p className="m-0 py-12 text-center text-sm text-muted-foreground">Loading ticket…</p>
        ) : null}
        {ticket.isError ? (
          <Banner tone="error" role="alert">
            Could not load this ticket: {ticket.error.message}
          </Banner>
        ) : null}
        {data ? <TicketBody ticket={data} /> : null}
      </Sheet>
      {closing && data ? (
        <ConfirmDialog
          title="Close this ticket?"
          description={`"${data.title}" moves to closed tickets. Closed tickets cannot be reopened.`}
          confirmLabel="Close ticket"
          pendingLabel="Closing…"
          failureLabel="The ticket was not closed"
          destructive={false}
          onConfirm={() => closeTicket(data.id)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
          onClose={() => setClosing(false)}
        />
      ) : null}
    </>
  );
}
