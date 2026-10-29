import { http, HttpResponse } from 'msw';

import {
  createProduct,
  createProductType,
  deleteProduct,
  deleteProductType,
  fetchAppliances,
  fetchProductTypes,
  renameProductType,
  updateProduct,
} from './products';

import { productFixture, signIn } from '@/test/fixtures';
import { server } from '@/test/server';

const type = { id: 1, name: 'Solar home system', paygo_enabled: true };

function capture(method: 'post' | 'put' | 'delete', path: string, response: unknown) {
  const seen: { body?: unknown; calls: number } = { calls: 0 };
  server.use(
    http[method](path, async ({ request }) => {
      seen.calls += 1;
      seen.body = request.method === 'DELETE' ? undefined : await request.json();
      return HttpResponse.json(response as Record<string, unknown>);
    }),
  );
  return seen;
}

describe('products API', () => {
  beforeEach(() => {
    signIn();
  });

  it('lists types and products, coercing a decimal price and the sale count', async () => {
    server.use(
      http.get('/api/appliances/types', () => HttpResponse.json({ data: [type] })),
      http.get('/api/appliances', () =>
        HttpResponse.json({ data: [{ ...productFixture(), price: '1200.00', sold_count: '4' }] }),
      ),
    );

    await expect(fetchProductTypes()).resolves.toEqual([type]);
    await expect(fetchAppliances()).resolves.toEqual([productFixture({ sold_count: 4 })]);
  });

  it('creates, renames and deletes a type', async () => {
    const created = capture('post', '/api/appliances/types', { data: type });
    await expect(createProductType('Solar home system')).resolves.toEqual(type);
    expect(created.body).toEqual({ name: 'Solar home system' });

    const renamed = capture('put', '/api/appliances/types/1', { data: { ...type, name: 'SHS' } });
    await expect(renameProductType(1, 'SHS')).resolves.toMatchObject({ name: 'SHS' });
    expect(renamed.body).toEqual({ name: 'SHS' });

    const removed = capture('delete', '/api/appliances/types/1', { data: { message: 'ok' } });
    await deleteProductType(1);
    expect(removed.calls).toBe(1);
  });

  it('sends a product with its type id, and deletes one', async () => {
    const input = { name: 'Lamp', price: 500, typeId: 3 };
    const created = capture('post', '/api/appliances', { data: [] });
    await createProduct(input);
    expect(created.body).toEqual({ name: 'Lamp', price: 500, appliance_type_id: 3 });

    const updated = capture('put', '/api/appliances/9', { data: [] });
    await updateProduct(9, input);
    expect(updated.body).toEqual({ name: 'Lamp', price: 500, appliance_type_id: 3 });

    const removed = capture('delete', '/api/appliances/9', { data: {} });
    await deleteProduct(9);
    expect(removed.calls).toBe(1);
  });
});
