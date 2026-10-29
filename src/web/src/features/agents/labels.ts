import { sentenceCase } from '@/lib/format';

// `trigger_type` is the morph name of what moved the agent's balance.
const balanceEntryLabels: Record<string, string> = {
  agent_transaction: 'Payment collected',
  agent_appliance: 'Product sold',
  agent_charge: 'Balance added',
  agent_receipt: 'Money handed in',
  agent_commission: 'Commission earned',
};

export function balanceEntryLabel(triggerType: string): string {
  return balanceEntryLabels[triggerType] ?? sentenceCase(triggerType);
}

/**
 * The commission a receipt credits, as the backend's AgentReceiptObserver does: the agent keeps
 * their commission out of the cash they hand over, so it is credited only once they settle all
 * they hold, and never for more than the cash on the table.
 */
export function commissionCredited(collected: number, due: number, pending: number): number {
  if (collected <= 0 || due <= 0) {
    return 0;
  }
  if (Math.round(collected * 100) < Math.round(due * 100)) {
    return 0;
  }
  return Math.min(pending, collected);
}

export const agentTabs = [
  'assigned',
  'sold',
  'receipts',
  'balance',
  'commission',
  'transactions',
  'tickets',
] as const;
export type AgentTab = (typeof agentTabs)[number];

export const agentTabLabels: Record<AgentTab, string> = {
  assigned: 'Assigned products',
  sold: 'Sold products',
  receipts: 'Receipts',
  balance: 'Balance history',
  commission: 'Commission history',
  transactions: 'Transactions',
  tickets: 'Tickets',
};
