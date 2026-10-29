import { http, HttpResponse } from 'msw';

import { pluginFitsUsageType, updateCompanySettings, updateMapSettings } from './settings';

import { signIn } from '@/test/fixtures';
import { server } from '@/test/server';

const changes = {
  site_title: null,
  company_name: 'Spark',
  currency: 'NGN',
  country: null,
  language: null,
  vat_energy: 0,
  vat_appliance: 0,
  usage_type: null,
  down_payment_max_token_days: null,
};

describe('settings API', () => {
  beforeEach(() => {
    signIn();
  });

  it('sends empty SMS columns back as null when the company never set them', async () => {
    const sent: unknown[] = [];
    server.use(
      http.put('/api/settings/main/4', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ data: { id: 4, ...changes } });
      }),
    );

    await updateCompanySettings({ id: 4, ...changes }, changes);

    expect(sent).toEqual([{ ...changes, sms_gateway_id: null, transaction_sms_enabled: null }]);
  });

  it('keeps the sent map settings when the server answers with none', async () => {
    server.use(http.put('/api/map-settings/1', () => HttpResponse.json({ data: [] })));
    const settings = { id: 1, zoom: 5, latitude: 1, longitude: 2, provider: null };

    await expect(updateMapSettings(settings)).resolves.toEqual(settings);
  });

  it('offers general plugins to every company and the rest by business type', () => {
    const plugin = { id: 1, name: 'Meter', description: null, usage_type: 'mini-grid' };

    expect(pluginFitsUsageType(plugin, null)).toBe(false);
    expect(pluginFitsUsageType(plugin, 'mini-grid&shs')).toBe(true);
    expect(pluginFitsUsageType({ ...plugin, usage_type: 'general' }, null)).toBe(true);
  });
});
