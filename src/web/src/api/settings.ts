import { z } from 'zod';

import { apiRequest } from './client';
import { mapSettingsSchema, type MapSettings } from './customers';
import { dataOf } from './schemas';

// VAT columns are decimals in MySQL, which some drivers serialise as strings.
const decimal = z.coerce.number();

export const companySettingsSchema = z.object({
  id: z.number(),
  site_title: z.string().nullable(),
  company_name: z.string(),
  currency: z.string(),
  country: z.string().nullable(),
  language: z.string().nullable(),
  vat_energy: decimal,
  vat_appliance: decimal,
  usage_type: z.string().nullable(),
  sms_gateway_id: z.number().nullable().optional(),
  transaction_sms_enabled: z.boolean().nullable().optional(),
  down_payment_max_token_days: z.number().nullable().optional(),
  enabled_modules: z.array(z.string()).nullable().optional(),
});
export type CompanySettings = z.infer<typeof companySettingsSchema>;

/** Every main-settings column the company form edits or must send back unchanged. */
export const fetchCompanySettings = async () =>
  (await apiRequest('/settings/main', dataOf(companySettingsSchema.passthrough()))).data;

export type CompanySettingsChanges = Pick<
  CompanySettings,
  | 'site_title'
  | 'company_name'
  | 'currency'
  | 'country'
  | 'language'
  | 'vat_energy'
  | 'vat_appliance'
  | 'usage_type'
  | 'down_payment_max_token_days'
>;

/**
 * The endpoint writes every column it is sent, so the SMS columns, which this app does not
 * edit, go back with the values they have.
 */
export const updateCompanySettings = async (
  current: CompanySettings,
  changes: CompanySettingsChanges,
) =>
  (
    await apiRequest(`/settings/main/${current.id}`, dataOf(companySettingsSchema.passthrough()), {
      method: 'PUT',
      body: {
        ...changes,
        sms_gateway_id: current.sms_gateway_id ?? null,
        transaction_sms_enabled: current.transaction_sms_enabled ?? null,
      },
    })
  ).data;

/** Only the modules are sent, so the other columns keep the values they have. */
export const updateEnabledModules = async (settingsId: number, modules: string[]) =>
  (
    await apiRequest(`/settings/main/${settingsId}`, dataOf(companySettingsSchema.passthrough()), {
      method: 'PUT',
      body: { enabled_modules: modules },
    })
  ).data;

const currencyListSchema = dataOf(
  z.record(z.string(), z.object({ symbol: z.string(), name: z.string().optional() })),
);

export type Currency = { code: string; symbol: string; name: string };

export const fetchCurrencies = async (): Promise<Currency[]> =>
  Object.entries((await apiRequest('/settings/currency-list', currencyListSchema)).data).map(
    ([code, currency]) => ({ code, symbol: currency.symbol, name: currency.name ?? code }),
  );

export const fetchCountries = async () =>
  (
    await apiRequest(
      '/countries',
      dataOf(z.array(z.object({ id: z.number(), country_name: z.string() }))),
    )
  ).data.map((country) => country.country_name);

export const fetchUsageTypes = async () =>
  (
    await apiRequest(
      '/usage-types',
      dataOf(z.array(z.object({ id: z.number(), name: z.string(), value: z.string() }))),
    )
  ).data;

export const mapProviders = ['Open Street Map', 'Bing Maps'] as const;

export const updateMapSettings = async (settings: MapSettings) =>
  (
    await apiRequest(`/map-settings/${settings.id}`, mapSettingsSchema, {
      method: 'PUT',
      body: settings,
    })
  ).data[0] ?? settings;

const mpmPluginSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    usage_type: z.string(),
  })
  .passthrough();
export type MpmPlugin = z.infer<typeof mpmPluginSchema>;

/** Every plugin MPM ships, whether the company uses it or not. */
export const fetchMpmPlugins = async () =>
  (await apiRequest('/mpm-plugins', dataOf(z.array(mpmPluginSchema)))).data;

/** Switching a plugin on for the first time also installs it. */
export const setPluginEnabled = (plugin: MpmPlugin, enabled: boolean) =>
  apiRequest(`/plugins/${plugin.id}`, z.unknown(), {
    method: 'PUT',
    body: { ...plugin, checked: enabled },
  });

/** A plugin is offered only to companies of the business types it serves. */
export function pluginFitsUsageType(plugin: MpmPlugin, usageType: string | null): boolean {
  return plugin.usage_type === 'general' || (usageType ?? '').includes(plugin.usage_type);
}

const apiKeySchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  created_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  active: z.union([z.boolean(), z.number()]).transform(Boolean),
});
export type ApiKey = z.infer<typeof apiKeySchema>;

export const fetchApiKeys = async () =>
  (await apiRequest('/api-keys', dataOf(z.array(apiKeySchema)))).data;

/** The token comes back only here; the server keeps just its hash. */
export const createApiKey = async (name: string | null) =>
  (
    await apiRequest('/api-keys', dataOf(z.object({ id: z.number(), token: z.string() })), {
      method: 'POST',
      body: { name },
    })
  ).data;

export const deleteApiKey = (apiKeyId: number) =>
  apiRequest(`/api-keys/${apiKeyId}`, z.unknown(), { method: 'DELETE' });
