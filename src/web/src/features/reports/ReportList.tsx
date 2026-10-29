import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { Tab, Tabs } from '@spark/ui/tabs';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Download } from 'lucide-react';

import type { ReportSearch } from './routes';
import { nextRun, periodLabel, scheduleCopy } from './schedule';

import { downloadReport, fetchReports, type Report, type ReportType } from '@/api/reports';
import { can, readSession } from '@/auth/session';
import { Pagination } from '@/components/Pagination';
import { saveFile } from '@/lib/download';
import { formatDate, formatDateTime } from '@/lib/format';

const tabLabels: Record<ReportType, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  outsourced: 'Ticket payouts',
};

function reportName(type: ReportType, report: Report): string {
  if (type === 'outsourced') {
    return 'Outsourced ticket payouts';
  }
  const kind = type === 'monthly' ? 'Monthly revenue' : 'Weekly revenue';
  return report.name ? `${report.name} · ${kind}` : kind;
}

export function ReportList({ search }: { search: ReportSearch }) {
  const navigate = useNavigate({ from: '/reports' });
  const type = search.type ?? 'monthly';
  const page = search.page ?? 1;
  const allowed = can(readSession(), 'reports');

  const reports = useQuery({
    queryKey: ['reports', type, page],
    queryFn: () => fetchReports(type, page),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const download = useMutation({
    mutationFn: (report: Report) => downloadReport(type, report.id),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });

  const rows = reports.data?.data ?? [];
  const next = nextRun(type, new Date());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold">Reports</h1>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          Spreadsheets generated automatically after each period closes
        </p>
      </div>

      {!allowed ? (
        <Banner role="status">Reports need the reports permission.</Banner>
      ) : (
        <Card className="bg-panel">
          <div className="overflow-x-auto border-b border-border px-2 sm:px-4">
            <Tabs aria-label="Report type" className="border-0 bg-transparent">
              {(Object.keys(tabLabels) as ReportType[]).map((value) => (
                <Tab
                  key={value}
                  active={type === value}
                  onClick={() =>
                    void navigate({
                      search: { type: value === 'monthly' ? undefined : value },
                      replace: true,
                    })
                  }
                  className="shrink-0 whitespace-nowrap"
                >
                  {tabLabels[value]}
                </Tab>
              ))}
            </Tabs>
          </div>

          {download.isError ? (
            <div className="px-4 pt-4">
              <Banner tone="error" role="alert">
                The download failed: {download.error.message}
              </Banner>
            </div>
          ) : null}
          {reports.isPending ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading reports…</p>
          ) : null}
          {reports.isError ? (
            <div className="p-4">
              <Banner tone="error" role="alert">
                Could not load reports: {reports.error.message}
              </Banner>
            </div>
          ) : null}
          {reports.data && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-12 text-center text-sm text-muted-foreground">
              <p className="m-0 font-medium text-foreground">
                No {type === 'outsourced' ? 'ticket payout' : type} reports yet.
              </p>
              <p className="m-0 max-w-md">{scheduleCopy[type]}</p>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <>
              <Table aria-label={`${tabLabels[type]} reports`} className="hidden sm:table">
                <TableHeader>
                  <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                    <TableHead className="pl-5 font-semibold">Period</TableHead>
                    <TableHead className="font-semibold">Report</TableHead>
                    <TableHead className="font-semibold">Generated</TableHead>
                    <TableHead className="pr-5">
                      <span className="sr-only">Download</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="pl-5 font-semibold whitespace-nowrap">
                        {periodLabel(type, report.date)}
                      </TableCell>
                      <TableCell>{reportName(type, report)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(report.created_at)}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <DownloadButton
                          label={`Download ${periodLabel(type, report.date)} ${reportName(type, report)} report`}
                          pending={download.isPending && download.variables.id === report.id}
                          onDownload={() => download.mutate(report)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <ul
                aria-label={`${tabLabels[type]} reports`}
                className="m-0 flex list-none flex-col gap-2 p-3 sm:hidden"
              >
                {rows.map((report) => (
                  <li
                    key={report.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate">{periodLabel(type, report.date)}</strong>
                      <span className="block truncate text-xs text-muted-foreground">
                        {reportName(type, report)} · {formatDateTime(report.created_at)}
                      </span>
                    </span>
                    <DownloadButton
                      label={`Download ${periodLabel(type, report.date)} ${reportName(type, report)} report`}
                      pending={download.isPending && download.variables.id === report.id}
                      onDownload={() => download.mutate(report)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {reports.data ? (
            <p className="m-0 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
              Next report: {formatDate(next.toISOString())} at {next.toISOString().slice(11, 16)}{' '}
              UTC
            </p>
          ) : null}
          {reports.data && reports.data.last_page > 1 ? (
            <Pagination
              page={reports.data}
              noun="report"
              onPage={(next) =>
                void navigate({
                  search: (previous) => ({ ...previous, page: next === 1 ? undefined : next }),
                })
              }
            />
          ) : null}
        </Card>
      )}
    </div>
  );
}

function DownloadButton({
  label,
  pending,
  onDownload,
}: {
  label: string;
  pending: boolean;
  onDownload: () => void;
}) {
  return (
    <Button variant="outline" size="sm" aria-label={label} disabled={pending} onClick={onDownload}>
      <Download aria-hidden="true" />
      {pending ? 'Downloading…' : 'Download'}
    </Button>
  );
}
