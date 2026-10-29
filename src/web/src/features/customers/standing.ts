import type { ListedPerson } from '@/api/people';

export type Standing = {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `since` (a date or datetime string) to `today`. */
export function daysSince(since: string, today: Date): number {
  const start = Date.parse(`${since.slice(0, 10)}T00:00:00Z`);
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - start) / DAY_MS);
}

export function standingOf(person: ListedPerson, today: Date = new Date()): Standing {
  if (person.contracts_count === 0) {
    return { status: 'neutral', label: 'No contract' };
  }
  if (person.overdue_since) {
    // The backend counts an installment as overdue from the day after it was due, so a
    // clock or time zone behind the server's must not show "0 days".
    const days = Math.max(1, daysSince(person.overdue_since, today));
    return { status: 'error', label: `Overdue ${days} ${days === 1 ? 'day' : 'days'}` };
  }
  if (person.outstanding_amount === 0) {
    return { status: 'info', label: 'Paid off' };
  }
  return person.is_active
    ? { status: 'success', label: 'Paying' }
    : { status: 'warning', label: 'Not paying' };
}
