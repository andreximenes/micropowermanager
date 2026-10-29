import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf, paginatorOf } from './schemas';

/** Colors the backend accepts for a category, in the order the picker shows them. */
export const categoryColors = [
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'sky',
  'blue',
  'purple',
  'pink',
  'black',
  'nocolor',
] as const;
export type CategoryColor = (typeof categoryColors)[number];

// MySQL booleans arrive as 0/1.
const flag = z.union([z.boolean(), z.number()]).transform(Boolean);

export const ticketCategorySchema = z.object({
  id: z.number(),
  label_name: z.string(),
  label_color: z.string().nullable(),
  out_source: flag,
});
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

/**
 * A ticket's assignee. Tickets point at a ticket user, which a CRM user gets on sign-up; outside
 * people (`out_source`) are ticket users without a login.
 */
const assigneeSchema = z.object({
  id: z.number(),
  user_name: z.string(),
  out_source: flag,
});

/** A CRM user as the ticket screens list them, with the ticket user tickets are assigned to. */
const crmUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  relation_ticket_user: z.object({ id: z.number() }).nullable(),
});
export type CrmUser = z.infer<typeof crmUserSchema>;

export type Assignee = { id: number; name: string; userId: number };

const commentSchema = z.object({
  id: z.number(),
  comment: z.string(),
  created_at: z.string().nullable(),
  ticket_user: z.object({ id: z.number(), user_name: z.string() }).nullable(),
});
export type TicketComment = z.infer<typeof commentSchema>;

export const ticketSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string().nullable(),
  /** 0 open, 1 closed. */
  status: z.number(),
  // "2026-10-26 00:00:00": only the day matters, and reading it as local time would shift it.
  due_date: z
    .string()
    .nullable()
    .transform((value) => value?.slice(0, 10) ?? null),
  created_at: z.string().nullable(),
  category: ticketCategorySchema.nullable(),
  owner: z.object({ id: z.number(), name: z.string(), surname: z.string() }).nullable(),
  assigned_to: assigneeSchema.nullable().optional(),
  comments: z.array(commentSchema).default([]),
});
export type Ticket = z.infer<typeof ticketSchema>;

export type TicketFilters = {
  status?: 0 | 1;
  category?: number;
  /** A ticket user's id. */
  person?: number;
  customer?: number;
};

// The list endpoint reads its page size from `limit`.
export type TicketQuery = TicketFilters & { page?: number; limit: number };

export const fetchTickets = (query: TicketQuery) =>
  apiRequest('/tickets/ticket', paginatorOf(ticketSchema), { query });

/** How many tickets match, without loading them. */
export const countTickets = async (filters: TicketFilters) =>
  (
    await apiRequest('/tickets/ticket', z.object({ total: z.number() }), {
      query: { ...filters, limit: 1 },
    })
  ).total;

export const fetchTicket = async (ticketId: number) =>
  (await apiRequest(`/tickets/ticket/${ticketId}`, dataOf(ticketSchema))).data;

export type NewTicket = {
  title: string;
  description: string;
  categoryId: number;
  customerId: number;
  assigneeId: number | null;
  /** YYYY-MM-DD. */
  dueDate: string | null;
  /** What an outsourced category pays for this ticket. */
  outsourcing: number | null;
};

export const createTicket = async (ticket: NewTicket) =>
  (
    await apiRequest('/tickets/ticket', dataOf(z.object({ id: z.number() })), {
      method: 'POST',
      body: {
        title: ticket.title,
        description: ticket.description,
        label: ticket.categoryId,
        owner_id: ticket.customerId,
        assignedPerson: ticket.assigneeId,
        dueDate: ticket.dueDate,
        ...(ticket.outsourcing === null ? {} : { outsourcing: ticket.outsourcing }),
      },
    })
  ).data;

export const closeTicket = (ticketId: number) =>
  apiRequest(`/tickets/ticket/${ticketId}`, z.unknown(), { method: 'DELETE' });

export const addComment = (ticketId: number, comment: string) =>
  apiRequest('/tickets/comments', z.unknown(), {
    method: 'POST',
    body: { cardId: ticketId, comment },
  });

export const fetchTicketCategories = async () =>
  (await apiRequest('/tickets/labels', dataOf(z.array(ticketCategorySchema)))).data;

export type CategoryInput = { name: string; color: CategoryColor; outsourced: boolean };

const categoryBody = (category: CategoryInput) => ({
  labelName: category.name,
  labelColor: category.color,
  outSourcing: category.outsourced,
});

export const createTicketCategory = (category: CategoryInput) =>
  apiRequest('/tickets/labels', z.unknown(), { method: 'POST', body: categoryBody(category) });

/** CRM users, each with the ticket user tickets are assigned to, when they have one. */
export const fetchCrmUsers = async () =>
  (await apiRequest('/tickets/users', dataOf(z.array(crmUserSchema)))).data;

/** The people a ticket can be assigned to. */
export const fetchAssignees = async (): Promise<Assignee[]> =>
  (await fetchCrmUsers()).flatMap((user) =>
    user.relation_ticket_user
      ? [{ id: user.relation_ticket_user.id, name: user.name, userId: user.id }]
      : [],
  );

export const addExternalTicketUser = (name: string, phone: string) =>
  apiRequest('/tickets/users/external', z.unknown(), {
    method: 'POST',
    body: { username: name, phone },
  });
