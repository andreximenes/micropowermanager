import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf } from './schemas';

/** The keys of `spark-shs.audiences` in the backend config. */
export const audiences = ['production', 'development'] as const;
export type Audience = (typeof audiences)[number];

export const audienceLabels: Record<Audience, string> = {
  production: 'Production',
  development: 'Development (staging)',
};

const credentialsSchema = z.object({
  client_id: z.string().nullable(),
  /** The secret itself never leaves the server. */
  has_client_secret: z.boolean(),
  auth_url: z.string(),
  api_url: z.string(),
  audience: z.enum(audiences),
  updated_at: z.string().nullable(),
});
export type SparkShsCredentials = z.infer<typeof credentialsSchema>;

export type CredentialsInput = {
  client_id: string;
  /** Blank keeps the stored secret, as long as the auth URL stays the same. */
  client_secret: string;
  auth_url: string;
  api_url: string;
  audience: Audience;
};

export const fetchSparkShsCredentials = async () =>
  (await apiRequest('/spark-shs/credentials', dataOf(credentialsSchema))).data;

export const saveSparkShsCredentials = async (input: CredentialsInput) =>
  (
    await apiRequest('/spark-shs/credentials', dataOf(credentialsSchema), {
      method: 'PUT',
      body: input,
    })
  ).data;

/**
 * Signs in to the Spark cloud with these credentials and reads one page of kits. Resolves to
 * false when Spark refuses the credentials; an unreachable or misconfigured server rejects.
 */
export const checkSparkShsCredentials = async (input: CredentialsInput) =>
  (
    await apiRequest('/spark-shs/credentials/check', z.object({ valid: z.boolean() }), {
      method: 'POST',
      body: input,
    })
  ).valid;

const count = z.number().catch(0);

// A sync that failed records only `{error}`, and PHP serialises an empty map as `[]`.
const syncResultSchema = z
  .object({
    created: count.optional(),
    existing: count.optional(),
    unmatched_kit_types: z
      .union([z.record(z.string(), z.number()), z.array(z.unknown())])
      .nullable()
      .optional(),
    conflicts: z.array(z.string()).nullable().optional().catch(null),
    error: z.string().nullable().optional(),
  })
  .transform((result) => ({
    created: result.created ?? 0,
    existing: result.existing ?? 0,
    unmatchedKitTypes: Array.isArray(result.unmatched_kit_types)
      ? []
      : Object.entries(result.unmatched_kit_types ?? {}),
    conflicts: result.conflicts ?? [],
    error: result.error ?? null,
  }));
export type SyncResult = z.output<typeof syncResultSchema>;

const syncSettingsSchema = z.object({
  is_enabled: z.boolean(),
  interval_hours: z.number(),
  last_sync_at: z.string().nullable(),
  last_sync_status: z.string().nullable(),
  last_sync_result: syncResultSchema.nullable(),
});
export type SyncSettings = z.output<typeof syncSettingsSchema>;

export const fetchSyncSettings = async () =>
  (await apiRequest('/spark-shs/sync/settings', dataOf(syncSettingsSchema))).data;

export const saveSyncSettings = async (settings: { is_enabled: boolean; interval_hours: number }) =>
  (
    await apiRequest('/spark-shs/sync/settings', dataOf(syncSettingsSchema), {
      method: 'PUT',
      body: settings,
    })
  ).data;

/** Queues a sync; the job records its outcome on the sync settings. */
export const startSync = () =>
  apiRequest('/spark-shs/sync', z.object({ queued: z.boolean() }), { method: 'POST' });

const kitTypeRuleSchema = z.object({
  id: z.number(),
  pattern: z.string(),
  appliance_id: z.number().nullable(),
  appliance: z.object({ id: z.number(), name: z.string() }).nullable(),
});
export type KitTypeRule = z.infer<typeof kitTypeRuleSchema>;

export type KitTypeRuleInput = { pattern: string; appliance_id: number | null };

export const fetchKitTypeRules = async () =>
  (await apiRequest('/spark-shs/sync/kit-type-mappings', dataOf(z.array(kitTypeRuleSchema)))).data;

export const saveKitTypeRule = async (ruleId: number | null, rule: KitTypeRuleInput) =>
  (
    await apiRequest(
      ruleId === null
        ? '/spark-shs/sync/kit-type-mappings'
        : `/spark-shs/sync/kit-type-mappings/${ruleId}`,
      dataOf(kitTypeRuleSchema),
      { method: ruleId === null ? 'POST' : 'PUT', body: rule },
    )
  ).data;

export const deleteKitTypeRule = (ruleId: number) =>
  apiRequest(`/spark-shs/sync/kit-type-mappings/${ruleId}`, z.unknown(), { method: 'DELETE' });

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * The sync runs on a queue worker, so the settings are read until a newer `last_sync_at` shows
 * it finished. Resolves to null when it is still running after `attempts` reads.
 */
export async function waitForSync(
  previousSyncAt: string | null,
  { intervalMs = 2000, attempts = 90 }: { intervalMs?: number; attempts?: number } = {},
): Promise<SyncSettings | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await wait(intervalMs);
    const settings = await fetchSyncSettings();
    if (settings.last_sync_at !== previousSyncAt) {
      return settings;
    }
  }
  return null;
}

const kitComponentsSchema = z.object({
  /** Decided by the plugin, which can see the manufacturer's API name. */
  is_spark_kit: z.boolean(),
  components: z.array(z.object({ id: z.number(), serial: z.string(), type: z.string() })),
});
export type KitComponents = z.infer<typeof kitComponentsSchema>;

/** The devices connected to a Spark kit, as of the last kit sync. */
export const fetchKitComponents = async (solarHomeSystemId: number) =>
  (
    await apiRequest(
      `/spark-shs/solar-home-systems/${solarHomeSystemId}/components`,
      dataOf(kitComponentsSchema),
    )
  ).data;
