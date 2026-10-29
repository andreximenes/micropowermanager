import { z } from 'zod';

import { solarHomeSystemSorts, type SolarHomeSystemQuery } from '@/api/solarHomeSystems';

// The router parses search values as JSON, so `?term=6380` arrives as a number.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);
const id = z.coerce.number().int().positive().optional().catch(undefined);

export const appliancesSearchSchema = z.object({ type: id, term: text });
export type AppliancesSearch = z.infer<typeof appliancesSearchSchema>;

export const perPageOptions = [15, 50, 100] as const;
export const DEFAULT_PER_PAGE = 15;
export const DEFAULT_SORT = '-updated_at';

/** Everything the list shows lives in the URL, so reload, back and links keep it. */
export const solarHomeSystemListSearchSchema = z.object({
  term: text,
  sort: z.enum(solarHomeSystemSorts).optional().catch(undefined),
  page: id,
  per_page: z
    .union(perPageOptions.map((size) => z.literal(size)))
    .optional()
    .catch(undefined),
});
export type SolarHomeSystemListSearch = z.infer<typeof solarHomeSystemListSearchSchema>;

export function solarHomeSystemQueryOf(search: SolarHomeSystemListSearch): SolarHomeSystemQuery {
  return {
    page: search.page,
    per_page: search.per_page ?? DEFAULT_PER_PAGE,
    sort_by: search.sort ?? DEFAULT_SORT,
    term: search.term?.trim() || undefined,
  };
}
