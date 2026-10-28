import type { Contract, Rate } from '@/api/schemas';

export type ContractSummary = {
  contract: Contract;
  paidRates: number;
  totalRates: number;
  paidAmount: number;
  outstanding: number;
  nextRate: Rate | null;
  overdue: boolean;
};

export type CustomerStanding = 'overdue' | 'on-track' | 'paid-off' | 'no-contract';

const byDueDate = (a: Rate, b: Rate) => a.due_date.localeCompare(b.due_date);

export function summarizeContract(contract: Contract, today: Date = new Date()): ContractSummary {
  const rates = [...contract.rates].sort(byDueDate);
  const open = rates.filter((rate) => rate.remaining > 0);
  const todayIso = today.toISOString().slice(0, 10);
  return {
    contract,
    paidRates: rates.length - open.length,
    totalRates: rates.length,
    paidAmount: rates.reduce((sum, rate) => sum + (rate.rate_cost - rate.remaining), 0),
    outstanding: open.reduce((sum, rate) => sum + rate.remaining, 0),
    nextRate: open[0] ?? null,
    overdue: open.some((rate) => rate.due_date.slice(0, 10) < todayIso),
  };
}

/** Contracts that still count: not cancelled, newest first. */
export function activeContracts(contracts: Contract[]): Contract[] {
  return contracts
    .filter((contract) => contract.deleted_at === null)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export function customerStanding(summaries: ContractSummary[]): CustomerStanding {
  if (summaries.length === 0) {
    return 'no-contract';
  }
  if (summaries.some((summary) => summary.overdue)) {
    return 'overdue';
  }
  const installmentPlans = summaries.filter((summary) => summary.contract.payment_type === 'installment');
  if (installmentPlans.length > 0 && installmentPlans.every((summary) => summary.outstanding === 0)) {
    return 'paid-off';
  }
  return 'on-track';
}
