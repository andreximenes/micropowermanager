import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf, paginatorOf } from './schemas';

// Money columns are decimals in MySQL, which some drivers serialise as strings.
const amount = z.coerce.number();

export const commissionTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  /** Share of energy payments, 0–1. */
  energy_commission: amount,
  /** Share of product sales, 0–1. */
  appliance_commission: amount,
  /** How far the balance may go below zero before the agent is blocked. */
  risk_balance: amount,
});
export type CommissionType = z.infer<typeof commissionTypeSchema>;

const agentPersonSchema = z.object({
  id: z.number(),
  name: z.string(),
  surname: z.string(),
  gender: z.string().nullable(),
  birth_date: z.string().nullable(),
  addresses: z
    .array(
      z.object({
        id: z.number(),
        phone: z.string().nullable(),
        is_primary: z.coerce.number(),
      }),
    )
    .default([]),
});

export const agentSchema = z.object({
  id: z.number(),
  email: z.string(),
  /** Company money the agent holds from payments and sales, less what they handed in. */
  balance: amount,
  commission_revenue: amount,
  created_at: z.string().nullable(),
  person: agentPersonSchema,
  mini_grid: z.object({ id: z.number(), name: z.string() }).nullable(),
  commission: commissionTypeSchema.nullable(),
});
export type Agent = z.infer<typeof agentSchema>;

export const listedAgentSchema = agentSchema.extend({
  customer_count: z.coerce.number(),
  sales_count: z.coerce.number(),
  /** Recorded a payment or a sale in the last 30 days. */
  is_active: z.union([z.boolean(), z.number()]).transform(Boolean),
});
export type ListedAgent = z.infer<typeof listedAgentSchema>;

/** Every agent: a company has tens of them, so the list filters and pages them in the browser. */
export const fetchAllAgents = async () =>
  (await apiRequest('/agents', dataOf(z.array(listedAgentSchema)))).data;

export const fetchAgent = async (agentId: number) =>
  (await apiRequest(`/agents/${agentId}`, dataOf(agentSchema))).data;

export function primaryPhone(agent: Pick<Agent, 'person'>): string | null {
  const addresses = agent.person.addresses;
  return (addresses.find((address) => address.is_primary === 1) ?? addresses[0])?.phone ?? null;
}

export type NewAgent = {
  name: string;
  surname: string;
  email: string;
  password: string;
  /** E.164. */
  phone: string | null;
  gender: string | null;
  /** YYYY-MM-DD. */
  birthDate: string | null;
  miniGridId: number;
  commissionTypeId: number;
};

export const createAgent = async (agent: NewAgent) =>
  (
    await apiRequest('/agents', dataOf(z.object({ id: z.number() })), {
      method: 'POST',
      body: {
        name: agent.name,
        surname: agent.surname,
        email: agent.email,
        password: agent.password,
        phone: agent.phone,
        gender: agent.gender,
        birth_date: agent.birthDate,
        // The endpoint takes the agent's mini-grid as `city_id`.
        city_id: agent.miniGridId,
        agent_commission_id: agent.commissionTypeId,
        is_primary: 1,
        is_customer: 0,
      },
    })
  ).data;

export type AgentChanges = {
  name: string;
  surname: string;
  gender: string | null;
  birthDate: string | null;
  phone: string | null;
  miniGridId: number;
  commissionTypeId: number;
};

export const updateAgent = (agentId: number, changes: AgentChanges) =>
  apiRequest(`/agents/${agentId}`, z.unknown(), {
    method: 'PUT',
    body: {
      name: changes.name,
      surname: changes.surname,
      miniGridId: changes.miniGridId,
      commissionTypeId: changes.commissionTypeId,
      // Optional fields are validated only when sent, so blanks stay out.
      ...(changes.gender ? { gender: changes.gender } : {}),
      ...(changes.birthDate ? { birthday: changes.birthDate } : {}),
      ...(changes.phone ? { phone: changes.phone } : {}),
    },
  });

export const changeAgentPassword = (agentId: number, password: string) =>
  apiRequest(`/agents/${agentId}/password`, z.unknown(), {
    method: 'PUT',
    body: { password, password_confirmation: password },
  });

const deleteResultSchema = dataOf(z.object({ message: z.string(), status_code: z.number() }));

/** The endpoint answers 200 either way and puts the outcome in the body. */
export async function deleteAgent(agentId: number): Promise<void> {
  const { data } = await apiRequest(`/agents/${agentId}`, deleteResultSchema, {
    method: 'DELETE',
  });
  if (data.status_code >= 400) {
    throw new Error(data.message);
  }
}

export const fetchMiniGrids = async () =>
  (await apiRequest('/mini-grids', dataOf(z.array(z.object({ id: z.number(), name: z.string() })))))
    .data;

export const fetchCommissionTypes = async () =>
  (await apiRequest('/agents/commissions', dataOf(z.array(commissionTypeSchema)))).data;

export type CommissionTypeInput = Omit<CommissionType, 'id'>;

export const createCommissionType = (commission: CommissionTypeInput) =>
  apiRequest('/agents/commissions', z.unknown(), { method: 'POST', body: commission });

export const updateCommissionType = (commissionId: number, commission: CommissionTypeInput) =>
  apiRequest(`/agents/commissions/${commissionId}`, z.unknown(), {
    method: 'PUT',
    body: commission,
  });

export const deleteCommissionType = (commissionId: number) =>
  apiRequest(`/agents/commissions/${commissionId}`, z.unknown(), { method: 'DELETE' });

/** Records cash the agent received from the company, which they now hold. */
export const addAgentBalance = (agentId: number, value: number) =>
  apiRequest('/agents/charge', z.unknown(), {
    method: 'POST',
    body: { agent_id: agentId, amount: value },
  });

/** Records cash the agent handed in. */
export const addAgentReceipt = (agentId: number, value: number) =>
  apiRequest('/agents/receipt', z.unknown(), {
    method: 'POST',
    body: { agent_id: agentId, amount: value },
  });

const assignedProductSchema = z.object({
  id: z.number(),
  /** The price the agent sells it at. */
  cost: amount,
  created_at: z.string().nullable(),
  appliance: z
    .object({
      id: z.number(),
      name: z.string(),
      appliance_type: z.object({ name: z.string() }).nullable().optional(),
    })
    .nullable(),
});
export type AssignedProduct = z.infer<typeof assignedProductSchema>;

export const fetchAssignedProducts = (agentId: number, page: number) =>
  apiRequest(`/agents/assigned/${agentId}`, paginatorOf(assignedProductSchema), {
    query: { page, per_page: 15 },
  });

export const assignProduct = (agentId: number, userId: number, productId: number, cost: number) =>
  apiRequest('/agents/assigned', z.unknown(), {
    method: 'POST',
    body: { agent_id: agentId, user_id: userId, appliance_id: productId, cost },
  });

export const unassignProduct = (assignedId: number) =>
  apiRequest(`/agents/assigned/${assignedId}`, z.unknown(), { method: 'DELETE' });

const soldProductSchema = z.object({
  id: z.number(),
  total_cost: amount,
  created_at: z.string().nullable(),
  person: z.object({ id: z.number(), name: z.string(), surname: z.string() }).nullable(),
  appliance: z.object({ name: z.string() }).nullable().optional(),
  device_serial: z.string().nullable().optional(),
});
export type SoldProduct = z.infer<typeof soldProductSchema>;

export const fetchSoldProducts = (agentId: number, page: number) =>
  apiRequest(`/agents/sold/${agentId}`, paginatorOf(soldProductSchema), {
    query: { page, per_page: 15 },
  });

const receiptSchema = z.object({
  id: z.number(),
  amount,
  created_at: z.string().nullable(),
  user: z.object({ name: z.string() }).nullable(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const fetchReceipts = (agentId: number, page: number) =>
  apiRequest(`/agents/receipt/${agentId}`, paginatorOf(receiptSchema), {
    query: { page, per_page: 15 },
  });

const balanceEntrySchema = z.object({
  id: z.number(),
  amount,
  available_balance: amount,
  trigger_type: z.string(),
  created_at: z.string().nullable(),
});
export type BalanceEntry = z.infer<typeof balanceEntrySchema>;

export const fetchBalanceHistory = (
  agentId: number,
  type: 'balance' | 'commission',
  page: number,
  perPage = 15,
) =>
  apiRequest(`/agents/balance/history/${agentId}`, paginatorOf(balanceEntrySchema), {
    query: { type, page, per_page: perPage },
  });

const agentTransactionSchema = z.object({
  id: z.number(),
  amount,
  type: z.string().nullable(),
  created_at: z.string(),
  device: z
    .object({
      device_serial: z.string(),
      person: z.object({ id: z.number(), name: z.string(), surname: z.string() }).nullable(),
    })
    .nullable()
    .optional(),
});
export type AgentTransaction = z.infer<typeof agentTransactionSchema>;

export const fetchAgentTransactions = (agentId: number, page: number) =>
  apiRequest(`/agents/transactions/${agentId}`, paginatorOf(agentTransactionSchema), {
    query: { page, per_page: 15 },
  });

const agentTicketSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.number(),
  created_at: z.string().nullable(),
  owner: z.object({ id: z.number(), name: z.string(), surname: z.string() }).nullable(),
});
export type AgentTicket = z.infer<typeof agentTicketSchema>;

export const fetchAgentTickets = (agentId: number, page: number) =>
  apiRequest(`/tickets/agents/${agentId}`, paginatorOf(agentTicketSchema), {
    query: { page, per_page: 15 },
  });
