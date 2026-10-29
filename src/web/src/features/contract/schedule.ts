import type { ContractDetail } from '@/api/contracts';
import type { Rate } from '@/api/schemas';
import { formatMoney } from '@/lib/format';
import { previewPlan } from '@/features/customer/salePlan';
import { localDay, type ContractSummary } from '@/features/customer/contractSummary';

export type ScheduledRate = Rate & { label: string; isDownPayment: boolean };

export type RateStatus = 'paid' | 'overdue' | 'next' | 'upcoming';

export type ContractStatus = 'deleted' | 'overdue' | 'paid-off' | 'on-track';

/**
 * The rates in the order the backend pays them (due date, as AppliancePaymentService::
 * inScheduleOrder). A down payment is the first rate, due on the day of the sale, so the
 * installments are numbered from the rate after it.
 */
export function scheduleOf(contract: ContractDetail): ScheduledRate[] {
  const hasDownPayment = (contract.down_payment ?? 0) > 0;
  return [...contract.rates]
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)
    .map((rate, index) => {
      const isDownPayment = hasDownPayment && index === 0;
      const number = hasDownPayment ? index : index + 1;
      return {
        ...rate,
        isDownPayment,
        label: isDownPayment ? 'Down payment' : `Installment ${number}`,
      };
    });
}

export function rateStatus(
  rate: Rate,
  nextRate: Rate | null,
  today: Date = new Date(),
): RateStatus {
  if (rate.remaining <= 0) {
    return 'paid';
  }
  if (rate.due_date.slice(0, 10) < localDay(today)) {
    return 'overdue';
  }
  return rate.id === nextRate?.id ? 'next' : 'upcoming';
}

export function contractStatus(summary: ContractSummary): ContractStatus {
  const { contract } = summary;
  if (contract.deleted_at !== null) {
    return 'deleted';
  }
  if (summary.overdue) {
    return 'overdue';
  }
  if (
    contract.payment_type === 'installment' &&
    summary.totalRates > 0 &&
    summary.outstanding === 0
  ) {
    return 'paid-off';
  }
  return 'on-track';
}

/** Mirrors ApplianceRateController::update: only untouched installments, never the down payment. */
export function canEditRate(contract: ContractDetail, rate: ScheduledRate): boolean {
  return (
    contract.payment_type === 'installment' &&
    contract.deleted_at === null &&
    !rate.isDownPayment &&
    rate.remaining === rate.rate_cost
  );
}

/** Rates nothing has been paid on yet; a plan change only ever rewrites these. */
export const unpaidRates = (schedule: ScheduledRate[]) =>
  schedule.filter((rate) => rate.remaining === rate.rate_cost);

export function canChangePlan(contract: ContractDetail, schedule: ScheduledRate[]): boolean {
  return (
    contract.payment_type === 'installment' &&
    contract.deleted_at === null &&
    unpaidRates(schedule).length > 0
  );
}

export type CoveredRate = { rate: ScheduledRate; applied: number; settles: boolean };

/**
 * What a payment pays off, as ApplianceInstallmentPayer applies it: open rates in schedule
 * order are settled one by one until the money runs out, the last one possibly in part.
 */
export function coveredRates(schedule: ScheduledRate[], amount: number): CoveredRate[] {
  const covered: CoveredRate[] = [];
  let left = amount;
  for (const rate of schedule) {
    if (left <= 0) {
      break;
    }
    if (rate.remaining <= 0) {
      continue;
    }
    const applied = Math.min(left, rate.remaining);
    covered.push({ rate, applied, settles: applied === rate.remaining });
    left -= applied;
  }
  return covered;
}

export const daysCovered = (amount: number, pricePerDay: number | null) =>
  pricePerDay && pricePerDay > 0 ? Math.floor(amount / pricePerDay) : 0;

/** The amount rules of AppliancePaymentService::validateAmount, as a message for the form. */
export function paymentProblem(
  contract: ContractDetail,
  schedule: ScheduledRate[],
  amount: number,
  currency: string,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Enter an amount above zero.';
  }
  // Installments are whole amounts; the API refuses fractions.
  if (!Number.isInteger(amount)) {
    return 'Enter a whole amount.';
  }
  if (contract.payment_type === 'energy_service') {
    const minimum = contract.minimum_payable_amount ?? 0;
    return minimum > 0 && amount < minimum
      ? `The minimum payment is ${formatMoney(minimum, currency)}.`
      : null;
  }
  const totalRemaining = schedule.reduce((sum, rate) => sum + rate.remaining, 0);
  const next = schedule.find((rate) => rate.remaining > 0);
  if (amount > totalRemaining) {
    return `Only ${formatMoney(totalRemaining, currency)} is left to pay.`;
  }
  if (next && amount < next.remaining && amount !== totalRemaining) {
    return `Pay at least ${formatMoney(next.remaining, currency)}, what is left of the next installment.`;
  }
  return null;
}

export type PlanChangeInput = {
  newTotalCost: number;
  rateCount: number;
  rateType: 'monthly' | 'weekly';
};

export type PlanChangePreview = {
  paid: number;
  outstanding: number;
  rateCount: number;
  installment: number;
  lastInstallment: number;
  paidOffBy: string | null;
  reschedules: boolean;
};

// Noon UTC keeps the calendar day the same in every time zone while salePlan adds months.
const dayAt = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);

/**
 * Mirrors ApplianceRateService::recomputeRatesFromTotalCost. With the same count and
 * cadence the new balance is spread over the untouched rates on their current dates;
 * otherwise those rates are replaced by a fresh schedule that starts after the latest
 * rate already (partly) paid.
 */
export function previewPlanChange(
  contract: ContractDetail,
  schedule: ScheduledRate[],
  input: PlanChangeInput,
  today: Date = new Date(),
): PlanChangePreview | string {
  const paid = schedule.reduce((sum, rate) => sum + rate.rate_cost - rate.remaining, 0);
  if (!Number.isInteger(input.newTotalCost) || input.newTotalCost < 0) {
    return 'Enter the new total as a whole amount.';
  }
  if (input.newTotalCost < paid) {
    return 'The new total cannot be below what has already been paid.';
  }
  const outstanding = input.newTotalCost - paid;
  const plan = previewPlan(
    {
      totalCost: outstanding,
      downPayment: 0,
      rateCount: input.rateCount,
      rateType: input.rateType,
    },
    dayAt(rescheduleAnchor(contract, schedule, today)),
  );
  if (!plan) {
    return 'Enter at least one installment.';
  }
  const untouched = unpaidRates(schedule);
  const reschedules = input.rateCount !== untouched.length || input.rateType !== contract.rateType;
  return {
    paid,
    outstanding,
    rateCount: input.rateCount,
    installment: plan.installment,
    lastInstallment: plan.lastInstallment,
    paidOffBy: reschedules
      ? plan.paidOffBy.toISOString()
      : (untouched[untouched.length - 1]?.due_date ?? null),
    reschedules,
  };
}

function rescheduleAnchor(
  contract: ContractDetail,
  schedule: ScheduledRate[],
  today: Date,
): string {
  const settledDates = schedule
    .filter((rate) => rate.remaining !== rate.rate_cost)
    .map((rate) => rate.due_date)
    .sort();
  return settledDates.at(-1) ?? contract.first_payment_date ?? today.toISOString();
}
