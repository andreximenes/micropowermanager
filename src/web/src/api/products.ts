import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf } from './schemas';

/**
 * `ApplianceType::APPLIANCE_TYPE_SHS` in the backend. Every tenant is seeded with this id, and the
 * backend accepts only products of this type for a solar home system, so the two cannot drift apart.
 */
export const SOLAR_HOME_SYSTEM_TYPE_ID = 1;

export const productTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  /** Sold on a pay-as-you-go plan that unlocks the device with tokens, rather than for cash. */
  paygo_enabled: z.boolean(),
});
export type ProductType = z.infer<typeof productTypeSchema>;

export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  // Money columns are decimals in MySQL, which some drivers serialise as strings.
  price: z.coerce.number(),
  appliance_type_id: z.number(),
  appliance_type: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
  /** Contracts that sold this product. */
  sold_count: z.coerce.number(),
});
export type Product = z.infer<typeof productSchema>;

export type ProductInput = { name: string; price: number; typeId: number };

const anyData = z.object({ data: z.unknown() });

export const fetchProductTypes = async () =>
  (await apiRequest('/appliances/types', dataOf(z.array(productTypeSchema)))).data;

export const createProductType = async (name: string) =>
  (
    await apiRequest('/appliances/types', dataOf(productTypeSchema), {
      method: 'POST',
      body: { name },
    })
  ).data;

export const renameProductType = async (typeId: number, name: string) =>
  (
    await apiRequest(`/appliances/types/${typeId}`, dataOf(productTypeSchema), {
      method: 'PUT',
      body: { name },
    })
  ).data;

export const deleteProductType = (typeId: number) =>
  apiRequest(`/appliances/types/${typeId}`, anyData, { method: 'DELETE' });

/** Every product, unpaginated: a company sells a handful, and the sale form needs them all. */
export const fetchAppliances = async () =>
  (await apiRequest('/appliances', dataOf(z.array(productSchema)))).data;

const productBody = (product: ProductInput) => ({
  name: product.name,
  price: product.price,
  appliance_type_id: product.typeId,
});

// Both answer with the whole product list rather than the product, so callers refetch instead.
export const createProduct = (product: ProductInput) =>
  apiRequest('/appliances', anyData, { method: 'POST', body: productBody(product) });

export const updateProduct = (productId: number, product: ProductInput) =>
  apiRequest(`/appliances/${productId}`, anyData, { method: 'PUT', body: productBody(product) });

export const deleteProduct = (productId: number) =>
  apiRequest(`/appliances/${productId}`, anyData, { method: 'DELETE' });
