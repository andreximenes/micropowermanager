export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(amount)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  // Due dates arrive as plain dates (UTC midnight); formatting in the viewer's zone
  // would show the previous day west of Greenwich.
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function initials(name: string, surname: string): string {
  return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase();
}

/** Payment services arrive as table names such as `wavecom_transaction`. */
export function paymentChannel(service: string | null): string {
  if (!service) {
    return '—';
  }
  const words = service.replace(/_transaction$/, '').split('_');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** Month and year, e.g. "Jun 2027", read in UTC like `formatDate`. */
export function formatMonth(value: string | null | undefined): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
