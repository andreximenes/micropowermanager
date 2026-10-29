import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf } from './schemas';

/** In the order they should be imported, so later files can link to records the earlier ones made. */
export const importKinds = [
  'settings',
  'user-permissions',
  'clusters',
  'devices',
  'customers',
  'transactions',
  'appliances',
  'appliance-people',
] as const;
export type ImportKind = (typeof importKinds)[number];

/** What each import endpoint requires, as the backend's routes check it. */
export const importPermission: Record<ImportKind, string> = {
  settings: 'settings',
  'user-permissions': 'users',
  clusters: 'customers',
  devices: 'customers',
  customers: 'customers',
  transactions: 'transactions',
  appliances: 'appliances',
  'appliance-people': 'appliances',
};

// A refused background job reports only `success` and `errors`, without counts.
const count = z.number().default(0);

// A failed item names itself (`name`, a serial…) and carries `errors` keyed by field, an
// `error` string, or both; the keys differ per import, so only the shape is checked here.
const failedItemSchema = z.record(z.string(), z.unknown());
export type FailedItem = z.infer<typeof failedItemSchema>;

const outcomeSchema = z.object({
  success: z.boolean(),
  added_count: count,
  modified_count: count,
  failed_count: count,
  failed: z.array(failedItemSchema).default([]),
  /** Set when the whole file was refused, keyed by what went wrong. */
  errors: z.record(z.string(), z.unknown()).optional(),
});
export type ImportOutcome = z.infer<typeof outcomeSchema>;

const queuedSchema = z.object({ job_id: z.string() });

/** Sends a file's records. Large files are queued, and the answer is then a job to wait for. */
export const startImport = async (kind: ImportKind, records: unknown) =>
  (
    await apiRequest(`/import/${kind}`, dataOf(z.union([queuedSchema, outcomeSchema])), {
      method: 'POST',
      body: { data: records },
    })
  ).data;

const jobSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  result: outcomeSchema.nullable(),
  error: z.string().nullable().optional(),
});
export type ImportJob = z.infer<typeof jobSchema>;

export const fetchImportJob = async (jobId: string) =>
  (await apiRequest(`/import/status/${encodeURIComponent(jobId)}`, dataOf(jobSchema))).data;
