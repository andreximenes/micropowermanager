export type InstallmentPlan = {
  totalCost: number;
  downPayment: number;
  rateCount: number;
  rateType: 'monthly' | 'weekly';
};

export type PlanPreview = {
  financed: number;
  installment: number;
  lastInstallment: number;
  firstDue: Date;
  paidOffBy: Date;
};

function addPeriods(start: Date, count: number, rateType: InstallmentPlan['rateType']): Date {
  const date = new Date(start);
  if (rateType === 'monthly') {
    date.setMonth(date.getMonth() + count);
  } else {
    date.setDate(date.getDate() + 7 * count);
  }
  return date;
}

/**
 * Mirrors ApplianceRateService::generateRateSchedule: the financed amount (total minus
 * down payment) is split evenly, the last rate absorbs the rounding, and rate i falls
 * due i periods after the sale.
 */
export function previewPlan(plan: InstallmentPlan, today: Date = new Date()): PlanPreview | null {
  const financed = plan.totalCost - plan.downPayment;
  if (plan.rateCount < 1 || financed < 0 || !Number.isFinite(financed)) {
    return null;
  }
  const installment = Math.floor(financed / plan.rateCount);
  return {
    financed,
    installment,
    lastInstallment: financed - installment * (plan.rateCount - 1),
    firstDue: addPeriods(today, 1, plan.rateType),
    paidOffBy: addPeriods(today, plan.rateCount, plan.rateType),
  };
}
