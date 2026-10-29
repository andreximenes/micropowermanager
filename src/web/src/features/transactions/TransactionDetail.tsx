import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { StatusPill } from '@spark/ui/status-pill';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';

import { deviceLabel, transactionStatusOf, transactionTypeLabel } from './labels';

import { fetchTransaction, type PaymentHistory, type TransactionDetail } from '@/api/transactions';
import { can, readSession } from '@/auth/session';
import { CopyButton } from '@/components/CopyButton';
import { Sheet } from '@/components/Sheet';
import { Step } from '@/components/form';
import { formatDate, formatDateTime, formatMoney, paymentChannel } from '@/lib/format';

const smsStatusLabels: Record<number, string> = {
  0: 'Queued',
  1: 'Sent',
  2: 'Delivered',
  [-1]: 'Failed',
};

type Customer = { id: number; name: string; surname: string };
type Contract = { id: number; name: string | null };

function customerOf(transaction: TransactionDetail): Customer | null {
  return transaction.device?.person ?? transaction.appliance?.person ?? null;
}

/** The contracts whose installments this payment covered. */
function contractsOf(transaction: TransactionDetail): Contract[] {
  if (transaction.appliance) {
    return [{ id: transaction.appliance.id, name: transaction.appliance.appliance?.name ?? null }];
  }
  const ids = new Set<number>();
  for (const payment of transaction.payment_histories) {
    const contractId = payment.paid_for?.appliance_person_id;
    if (payment.paid_for_type === 'appliance_rate' && contractId !== undefined) {
      ids.add(contractId);
    }
  }
  return [...ids].map((id) => ({ id, name: null }));
}

function paidForLabel(payment: PaymentHistory): string {
  const dueDate = payment.paid_for?.due_date;
  if (payment.paid_for_type === 'appliance_rate' && dueDate) {
    const kind = payment.payment_type === 'down_payment' ? 'Down payment' : 'Installment';
    return `${kind} due ${formatDate(dueDate.slice(0, 10))}`;
  }
  return transactionTypeLabel(payment.payment_type);
}

function tokenValue(amount: number | null, unit: string | null): string | null {
  if (amount === null) {
    return null;
  }
  const value = amount.toLocaleString('en');
  return unit === 'days' ? `${value} days of energy` : `${value} ${unit ?? ''}`.trim();
}

/** The provider's own record as it was stored, without what the API joins onto it. */
function rawProviderRecord(transaction: TransactionDetail): string {
  const joined = new Set(['conflicts', 'user']);
  const record = Object.entries(transaction.original_transaction ?? {}).filter(
    ([key]) => !joined.has(key),
  );
  return JSON.stringify(Object.fromEntries(record), null, 2);
}

function Details({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TransactionBody({
  transaction,
  currency,
}: {
  transaction: TransactionDetail;
  currency: string;
}) {
  const session = readSession();
  const linksToCustomers = can(session, 'customers');
  const customer = customerOf(transaction);
  const contracts = contractsOf(transaction);
  const conflicts = transaction.original_transaction?.conflicts ?? [];
  const recordedBy = transaction.original_transaction?.user?.name;
  const token = transaction.token;
  const paidTotal = transaction.payment_histories.reduce((sum, payment) => sum + payment.amount, 0);

  const rows: [string, ReactNode][] = [
    ['Provider', paymentChannel(transaction.original_transaction_type)],
    ['Sender', transaction.sender ?? '—'],
    [
      'Customer',
      customer ? (
        <>
          {linksToCustomers ? (
            <Link to="/customers/$customerId" params={{ customerId: customer.id }}>
              {customer.name} {customer.surname}
            </Link>
          ) : (
            `${customer.name} ${customer.surname}`
          )}
          <span className="text-muted-foreground"> · ID {customer.id}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Unknown sender</span>
      ),
    ],
  ];
  if (contracts.length > 0) {
    rows.push([
      contracts.length === 1 ? 'Contract' : 'Contracts',
      <span className="flex flex-col gap-1">
        {contracts.map((contract) =>
          linksToCustomers ? (
            <Link
              key={contract.id}
              to="/contracts/$contractId"
              params={{ contractId: contract.id }}
            >
              {contract.name ?? `Contract #${contract.id}`}
            </Link>
          ) : (
            <span key={contract.id}>{contract.name ?? `Contract #${contract.id}`}</span>
          ),
        )}
      </span>,
    ]);
  }
  rows.push([
    'Device',
    transaction.device ? (
      <span className="flex flex-wrap items-center gap-2">
        <code className="rounded-sm bg-panel-2 px-2 py-0.5 text-xs break-all">
          {transaction.device.device_serial}
        </code>
        {deviceLabel(transaction.device.device_type)}
      </span>
    ) : (
      (transaction.message ?? '—')
    ),
  ]);
  rows.push(['Type', transactionTypeLabel(transaction.type)]);
  if (recordedBy) {
    rows.push(['Recorded by', recordedBy]);
  }

  return (
    <>
      {conflicts.length > 0 ? (
        <Banner tone="warning" role="alert" className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="block">
              {conflicts.length === 1 ? '1 conflict' : `${conflicts.length} conflicts`}
            </strong>
            {conflicts.map((conflict) => (
              <span key={conflict.id} className="block">
                {conflict.state}
              </span>
            ))}
          </span>
        </Banner>
      ) : null}

      <Details rows={rows} />

      {token ? (
        <section className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="m-0 text-base font-semibold">Token generated</h3>
            <CopyButton text={token.token} />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3.5">
            <span className="font-mono text-xl tracking-wider break-all">{token.token}</span>
            {tokenValue(token.token_amount, token.token_unit) ? (
              <span className="text-sm text-muted-foreground">
                {tokenValue(token.token_amount, token.token_unit)}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {transaction.payment_histories.length > 0 ? (
        <Step title="What it paid">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-2 font-semibold">Paid for</th>
                <th className="py-2 text-right font-semibold">Covered</th>
              </tr>
            </thead>
            <tbody>
              {transaction.payment_histories.map((payment) => {
                const rateCost = payment.paid_for?.rate_cost;
                return (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="py-2.5">{paidForLabel(payment)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {formatMoney(payment.amount, currency)}
                      {rateCost !== undefined && rateCost !== payment.amount ? (
                        <span className="text-muted-foreground">
                          {' '}
                          of {formatMoney(rateCost, currency)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-foreground font-bold">
                <td className="py-2.5">Total</td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  {formatMoney(paidTotal, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </Step>
      ) : null}

      {transaction.sms ? (
        <Step title="SMS sent">
          <div className="flex flex-col gap-1.5 rounded-lg bg-panel-2 px-3.5 py-3 text-sm">
            <span className="text-xs text-muted-foreground">
              {[
                transaction.sms.receiver ? `To ${transaction.sms.receiver}` : null,
                formatDateTime(transaction.sms.created_at),
                smsStatusLabels[transaction.sms.status],
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className="break-words">{transaction.sms.body}</span>
          </div>
        </Step>
      ) : null}

      {transaction.original_transaction ? (
        <details className="rounded-lg border border-border text-sm">
          <summary className="cursor-pointer px-4 py-3 font-medium">Raw provider message</summary>
          <pre className="m-0 overflow-x-auto rounded-b-lg border-t border-border bg-panel-2 px-4 py-3 text-xs whitespace-pre-wrap">
            {rawProviderRecord(transaction)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

type TransactionDetailPanelProps = {
  transactionId: number;
  currency: string;
  onClose: () => void;
};

/** One payment, opened over the list it was picked from. */
export function TransactionDetailPanel({
  transactionId,
  currency,
  onClose,
}: TransactionDetailPanelProps) {
  const transaction = useQuery({
    queryKey: ['transactions', 'detail', transactionId],
    queryFn: () => fetchTransaction(transactionId),
  });
  const session = readSession();
  const data = transaction.data;
  const status = data ? transactionStatusOf(data.original_transaction) : null;
  const contract = data ? contractsOf(data)[0] : undefined;

  return (
    <Sheet
      title={
        data && status ? (
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-2xl sm:text-3xl">{formatMoney(data.amount, currency)}</span>{' '}
            <StatusPill status={status.tone}>{status.label}</StatusPill>
          </span>
        ) : (
          `Transaction #${transactionId}`
        )
      }
      description={
        data
          ? `Transaction #${data.id} · ${paymentChannel(data.original_transaction_type)} · ${formatDateTime(data.created_at)}`
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="ml-auto">
            Done
          </Button>
          {contract && can(session, 'customers') ? (
            <Button asChild>
              <Link to="/contracts/$contractId" params={{ contractId: contract.id }}>
                Open contract
              </Link>
            </Button>
          ) : null}
        </>
      }
    >
      {transaction.isPending ? (
        <p className="m-0 py-12 text-center text-sm text-muted-foreground">Loading transaction…</p>
      ) : null}
      {transaction.isError ? (
        <Banner tone="error" role="alert">
          Could not load this transaction: {transaction.error.message}
        </Banner>
      ) : null}
      {data ? <TransactionBody transaction={data} currency={currency} /> : null}
    </Sheet>
  );
}
