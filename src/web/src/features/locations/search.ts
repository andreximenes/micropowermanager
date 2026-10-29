import { z } from 'zod';

const id = z.coerce.number().int().positive().optional().catch(undefined);

/**
 * What the locations screen shows lives in the URL: the cluster, site and village picked in
 * the tree (each with its parents, so the tree opens down to it), and `new` when adding one
 * inside the deepest of them.
 */
export const locationsSearchSchema = z.object({
  cluster: id,
  site: id,
  village: id,
  new: z.enum(['cluster', 'site', 'village']).optional().catch(undefined),
});
export type LocationsSearch = z.infer<typeof locationsSearchSchema>;
