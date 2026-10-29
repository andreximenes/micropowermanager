import type { ReportType } from '@/api/reports';
import { formatDate } from '@/lib/format';

/** When the scheduler in `bootstrap/app.php` produces each kind of report, in UTC. */
export const scheduleCopy: Record<ReportType, string> = {
  monthly: 'Monthly reports are generated on the 1st of each month at 03:00 UTC, one per village.',
  weekly: 'Weekly reports are generated every Monday at 03:00 UTC, one per village.',
  outsourced:
    'Outsourced ticket payout reports are generated on the 1st of each month at 03:30 UTC.',
};

/** The next time the scheduler runs for this kind of report. */
export function nextRun(type: ReportType, now: Date): Date {
  const [hour, minute] = type === 'outsourced' ? [3, 30] : [3, 0];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute);
  if (type === 'weekly') {
    const daysToMonday = (8 - new Date(today).getUTCDay()) % 7;
    const monday = today + daysToMonday * 86_400_000;
    return new Date(monday > now.getTime() ? monday : monday + 7 * 86_400_000);
  }
  const thisMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, hour, minute);
  return new Date(
    thisMonth > now.getTime()
      ? thisMonth
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, hour, minute),
  );
}

function monthName(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Reports store their period as "2026-09-01---2026-09-30". A period that starts on the 1st
 * reads as its month; a week reads as its two days.
 */
export function periodLabel(type: ReportType, date: string): string {
  const [start, end] = date.split('---');
  if (!start || !end) {
    return date;
  }
  if (type !== 'weekly' && start.endsWith('-01')) {
    return monthName(start);
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}
