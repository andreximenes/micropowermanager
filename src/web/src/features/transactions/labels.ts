import { CircleCheck, CircleHelp, CircleX, Clock, type LucideIcon } from 'lucide-react';

import type { DeviceType } from '@/api/people';
import type { AnalyticsPeriod, TransactionStatusFilter } from '@/api/transactions';

export type TransactionStatus = {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'neutral';
  Icon: LucideIcon;
};

const unknownStatus: TransactionStatus = { label: 'Unknown', tone: 'neutral', Icon: CircleHelp };

const statusByCode: Record<number, TransactionStatus> = {
  1: { label: 'Confirmed', tone: 'success', Icon: CircleCheck },
  2: { label: 'Confirmed', tone: 'success', Icon: CircleCheck },
  0: { label: 'Processing', tone: 'warning', Icon: Clock },
  [-1]: { label: 'Rejected', tone: 'error', Icon: CircleX },
  3: { label: 'Cancelled', tone: 'error', Icon: CircleX },
};

/** The payment provider's status; a payment with no provider record yet has none. */
export function transactionStatusOf(
  originalTransaction: { status: number } | null,
): TransactionStatus {
  return (originalTransaction && statusByCode[originalTransaction.status]) ?? unknownStatus;
}

export const statusFilterLabels: Record<TransactionStatusFilter, string> = {
  confirmed: 'Confirmed',
  processing: 'Processing',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const deviceLabels: Record<DeviceType, string> = {
  meter: 'Meter',
  solar_home_system: 'Solar home system',
  e_bike: 'E-bike',
};

/** Device types arrive as morph names such as `solar_home_system`. */
export function deviceLabel(deviceType: string): string {
  return deviceLabels[deviceType as DeviceType] ?? humanize(deviceType);
}

const typeLabels: Record<string, string> = {
  energy: 'Energy',
  down_payment: 'Down payment',
  deferred_payment: 'Installment',
  installment: 'Installment',
};

export function transactionTypeLabel(type: string | null): string {
  if (!type) {
    return '—';
  }
  return typeLabels[type] ?? humanize(type);
}

function humanize(value: string): string {
  const sentence = value.replace(/_/g, ' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

type PeriodCopy = {
  /** The segmented control's label. */
  label: string;
  /** What the cards count, and what they are compared with. */
  summary: string;
  /** Ends each card's change line: "+8% vs the day before". */
  comparedWith: string;
};

export const periodCopy: Record<AnalyticsPeriod, PeriodCopy> = {
  0: {
    label: 'Yesterday',
    summary: 'Yesterday · compared with the day before',
    comparedWith: 'the day before',
  },
  1: {
    label: 'Same day last week',
    summary: 'Yesterday · compared with the same day last week',
    comparedWith: 'the same day last week',
  },
  2: {
    label: '7 days',
    summary: 'Last 7 days · compared with the 7 days before',
    comparedWith: 'the 7 days before',
  },
  3: {
    label: '30 days',
    summary: 'Last 30 days · compared with the 30 days before',
    comparedWith: 'the 30 days before',
  },
};
