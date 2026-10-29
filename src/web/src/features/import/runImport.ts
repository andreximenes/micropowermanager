import { ApiError } from '@/api/client';
import {
  fetchImportJob,
  startImport,
  type FailedItem,
  type ImportKind,
  type ImportOutcome,
} from '@/api/imports';

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** The whole file was refused, or its background job failed; `details` says why when known. */
export class ImportFailure extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'ImportFailure';
    this.details = details;
  }
}

function messagesOf(errors: Record<string, unknown> | undefined): string[] {
  return Object.values(errors ?? {}).flatMap((value) =>
    (Array.isArray(value) ? value : [value]).filter(
      (message): message is string => typeof message === 'string',
    ),
  );
}

/** A failed record as one line: what it was and why it failed. */
export function describeFailedItem(item: FailedItem, index: number): string {
  const name = [item.name, item.device_serial, item.serial, item.email].find(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  const errors = item.errors && typeof item.errors === 'object' ? item.errors : {};
  const reasons = [
    ...(typeof item.error === 'string' ? [item.error] : []),
    ...messagesOf(errors as Record<string, unknown>),
  ];
  return `${name ?? `Record ${index + 1}`}: ${reasons.join(' ') || 'not imported'}`;
}

async function readRecords(file: File): Promise<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ImportFailure('This file is not JSON. Use a file exported from MicroPowerManager.');
  }
  // Exports wrap their records in `data`; a bare list is accepted too.
  if (parsed !== null && typeof parsed === 'object' && 'data' in parsed) {
    return parsed.data;
  }
  return parsed;
}

const sleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

async function waitForJob(jobId: string, signal: AbortSignal): Promise<ImportOutcome> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS, signal);
    const job = await fetchImportJob(jobId);
    if (job.status === 'completed' && job.result) {
      return job.result;
    }
    if (job.status === 'failed') {
      throw new ImportFailure(job.error ?? 'The import failed.', messagesOf(job.result?.errors));
    }
  }
  throw new ImportFailure(
    'The import is still running after 5 minutes. It carries on in the background; check the records later.',
  );
}

/**
 * Imports one exported file, waiting for the background job when the server queues it.
 * `onQueued` reports that the server took the file and is working through it.
 */
export async function runImport(
  kind: ImportKind,
  file: File,
  { signal, onQueued }: { signal: AbortSignal; onQueued: () => void },
): Promise<ImportOutcome> {
  const records = await readRecords(file);
  let started: Awaited<ReturnType<typeof startImport>>;
  try {
    started = await startImport(kind, records);
  } catch (error) {
    if (error instanceof ApiError) {
      // A 422 is a refusal of the file's contents; its reasons are in the field errors.
      const message = error.status === 422 ? 'The file was refused.' : error.message;
      throw new ImportFailure(message, messagesOf(error.fieldErrors));
    }
    throw error;
  }
  if (!('job_id' in started)) {
    return started;
  }
  onQueued();
  return waitForJob(started.job_id, signal);
}
