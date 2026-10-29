import type { CategoryColor, Ticket } from '@/api/tickets';
import { formatDate } from '@/lib/format';

export const categoryDotClass: Record<CategoryColor, string> = {
  red: 'bg-red',
  orange: 'bg-orange-500',
  yellow: 'bg-amber',
  lime: 'bg-lime-500',
  green: 'bg-green',
  sky: 'bg-sky-500',
  blue: 'bg-blue',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  black: 'bg-foreground',
  nocolor: 'bg-muted-foreground/40',
};

export const categoryColorNames: Record<CategoryColor, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  lime: 'Lime',
  green: 'Green',
  sky: 'Sky',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  black: 'Black',
  nocolor: 'No color',
};

export function dotClassOf(color: string | null): string {
  return categoryDotClass[color as CategoryColor] ?? categoryDotClass.nocolor;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today (UTC) to a YYYY-MM-DD date: negative when it has passed. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(date) - today) / DAY_MS);
}

export type DueState = { text: string; late: boolean };

export function dueStateOf(ticket: Pick<Ticket, 'due_date' | 'status'>, now?: Date): DueState {
  if (!ticket.due_date) {
    return { text: 'No due date', late: false };
  }
  const late = ticket.status === 0 && daysUntil(ticket.due_date, now) < 0;
  return { text: `Due ${formatDate(ticket.due_date)}${late ? ' · late' : ''}`, late };
}

/** "3 hours", "5 days": how long a ticket has been open. */
export function ageOf(createdAt: string | null, now: Date = new Date()): string {
  if (!createdAt) {
    return '—';
  }
  const hours = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 3.6e6));
  if (hours < 24) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

/** The assignee's name, marked when they are an outside person. */
export function assigneeLabel(ticket: Ticket): string {
  const assignee = ticket.assigned_to;
  if (!assignee) {
    return 'Unassigned';
  }
  return assignee.out_source ? `${assignee.user_name} (external)` : assignee.user_name;
}
