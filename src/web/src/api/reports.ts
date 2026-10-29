import { z } from 'zod';

import { apiDownload, apiRequest } from './client';
import { paginatorOf } from './schemas';

export const reportTypes = ['monthly', 'weekly', 'outsourced'] as const;
export type ReportType = (typeof reportTypes)[number];

const reportSchema = z.object({
  id: z.number(),
  /** The village the report covers; payout reports cover the whole company. */
  name: z.string().nullable().optional(),
  /** The period, stored as "2026-09-01---2026-09-30". */
  date: z.string(),
  created_at: z.string().nullable(),
});
export type Report = z.infer<typeof reportSchema>;

/** One page of a kind of report, as the scheduled commands stored them. */
export function fetchReports(type: ReportType, page: number) {
  if (type === 'outsourced') {
    return apiRequest('/tickets/reports', paginatorOf(reportSchema), {
      query: { page, per_page: 15 },
    });
  }
  return apiRequest('/reports', paginatorOf(reportSchema), { query: { type, page } });
}

export function downloadReport(type: ReportType, reportId: number) {
  return apiDownload(
    type === 'outsourced'
      ? `/tickets/reports/download/${reportId}`
      : `/reports/download/${reportId}`,
  );
}
