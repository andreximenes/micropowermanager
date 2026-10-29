import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { coveredRates, daysCovered, paymentProblem, type ScheduledRate } from './schedule';

import {
  CASH_PROVIDER,
  fetchPaymentProviders,
  startPayment,
  waitForPayment,
  type ContractDetail,
  type PaymentOutcome,
} from '@/api/contracts';
import { Sheet } from '@/components/Sheet';
import { formatDate, formatMoney } from '@/lib/format';

type RecordPaymentSheetProps = {
  contract: ContractDetail;
  schedule: ScheduledRate[];
  currency: string;
  onClose: () => void;
  onRecorded: () => Promise<void>;
  pollIntervalMs?: number;
};

const outcomeBanner: Record<
  PaymentOutcome,
  { tone: 'success' | 'error' | 'warning'; text: (payment: string) => string }
> = {
  processed: { tone: 'success', text: (payment) => `${payment} recorded.` },
  failed: {
    tone: 'error',
    text: (payment) => `${payment} failed. Nothing was added to this contract.`,
  },
  processing: {
    tone: 'warning',
    text: (payment) =>
      `${payment} is still being processed. Check the history again in a few minutes.`,
  },
};

const numberOf = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

export function RecordPaymentSheet({
  contract,
  schedule,
  currency,
  onClose,
  onRecorded,
  pollIntervalMs,
}: RecordPaymentSheetProps) {
  const isEnergyService = contract.payment_type === 'energy_service';
  const totalRemaining = schedule.reduce((sum, rate) => sum + rate.remaining, 0);
  const nextRate = schedule.find((rate) => rate.remaining > 0);
  const suggested = isEnergyService ? contract.minimum_payable_amount : nextRate?.remaining;

  const [providerId, setProviderId] = useState(CASH_PROVIDER.id);
  const [amountText, setAmountText] = useState(suggested ? String(suggested) : '');

  const providers = useQuery({ queryKey: ['payment-providers'], queryFn: fetchPaymentProviders });
  const providerList = providers.data ?? [CASH_PROVIDER];
  const provider = providerList.find((item) => item.id === providerId) ?? CASH_PROVIDER;

  const amount = numberOf(amountText);
  const problem =
    amountText.trim() === '' ? null : paymentProblem(contract, schedule, amount, currency);
  const money = (value: number) => formatMoney(value, currency);

  // Providers that take the payment on their own page return its address. It is shown as a
  // link: opening it ourselves after the request would be blocked as a pop-up.
  const [paymentPage, setPaymentPage] = useState<string | null>(null);

  const payment = useMutation({
    mutationFn: async (recorded: { amount: number; channel: string }) => {
      const started = await startPayment(contract.id, { amount: recorded.amount, providerId });
      setPaymentPage(started.redirect_url ?? null);
      return waitForPayment(started.transaction_id, { intervalMs: pollIntervalMs });
    },
    onSuccess: () => onRecorded(),
  });
  // Closing mid-payment and reopening would allow the same payment to be sent twice.
  const close = payment.isPending ? () => undefined : onClose;
  const paymentPageLink = paymentPage ? (
    <Banner tone="info" role="status">
      Finish the payment on the provider&apos;s page:{' '}
      <a href={paymentPage} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
        Open payment page
      </a>
    </Banner>
  ) : null;

  const ready = amountText.trim() !== '' && problem === null && !payment.isPending;
  const channel = provider.id === CASH_PROVIDER.id ? 'in cash' : `via ${provider.name}`;
  const title = 'Record payment';
  const description = isEnergyService
    ? `${contract.appliance?.name ?? 'Product'} · ${money(contract.price_per_day ?? 0)} per day`
    : `${contract.appliance?.name ?? 'Product'} · ${money(totalRemaining)} to pay`;
  const buttonClass = 'h-11 flex-1 sm:h-9 sm:flex-none';

  // The schedule refreshes once the payment settles, so the form would preview it again.
  if (payment.isSuccess) {
    const outcome = outcomeBanner[payment.data];
    return (
      <Sheet
        title={title}
        onClose={onClose}
        footer={
          <Button className={buttonClass} onClick={onClose}>
            Done
          </Button>
        }
      >
        <Banner tone={outcome.tone} role="status">
          {outcome.text(
            `The payment of ${money(payment.variables.amount)} ${payment.variables.channel}`,
          )}
        </Banner>
        {paymentPageLink}
      </Sheet>
    );
  }

  return (
    <Sheet
      title={title}
      description={description}
      onClose={close}
      footer={
        <Button
          className={buttonClass}
          disabled={!ready}
          onClick={() => payment.mutate({ amount, channel })}
        >
          {payment.isPending
            ? 'Recording…'
            : ready
              ? `Record ${money(amount)} ${channel}`
              : 'Record payment'}
        </Button>
      }
    >
      {payment.isError ? (
        <Banner tone="error" role="alert">
          The payment was not recorded: {payment.error.message}
        </Banner>
      ) : null}
      {paymentPageLink}

      <div
        role="radiogroup"
        aria-label="Payment method"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {providerList.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={providerId === item.id}
            disabled={payment.isPending}
            onClick={() => setProviderId(item.id)}
            className={`h-12 rounded-lg border px-3 font-medium ${providerId === item.id ? 'border-2 border-primary' : 'border-border'}`}
          >
            {item.name}
          </button>
        ))}
      </div>
      {providers.isError ? (
        <p className="text-sm text-muted-foreground">
          Only cash is available: the payment providers could not be loaded.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-label">
          Amount
          <span className="flex h-12 items-center gap-2 rounded-lg border border-input-border bg-input px-3.5 focus-within:ring-2 focus-within:ring-ring">
            <span className="text-muted-foreground" aria-hidden="true">
              {currency}
            </span>
            <input
              inputMode="numeric"
              value={amountText}
              disabled={payment.isPending}
              onChange={(event) => setAmountText(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-xl font-bold text-foreground outline-none"
            />
          </span>
        </label>
        {problem ? (
          <p role="alert" className="text-sm text-red">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {isEnergyService && contract.minimum_payable_amount ? (
            <Chip onClick={() => setAmountText(String(contract.minimum_payable_amount))}>
              Minimum · {money(contract.minimum_payable_amount)}
            </Chip>
          ) : null}
          {!isEnergyService && nextRate ? (
            <Chip onClick={() => setAmountText(String(nextRate.remaining))}>
              Next installment · {money(nextRate.remaining)}
            </Chip>
          ) : null}
          {!isEnergyService && totalRemaining > 0 ? (
            <Chip onClick={() => setAmountText(String(totalRemaining))}>
              Pay off · {money(totalRemaining)}
            </Chip>
          ) : null}
        </div>
      </div>

      {ready || payment.isPending ? (
        <div className="flex flex-col gap-2 rounded-lg bg-panel-2 px-4 py-3.5 text-sm">
          {isEnergyService ? (
            <strong>
              This payment covers {daysCovered(amount, contract.price_per_day)} days of energy.
            </strong>
          ) : (
            <>
              <strong>This payment covers</strong>
              <ul aria-label="Installments covered" className="flex flex-col gap-1.5">
                {coveredRates(schedule, amount).map(({ rate, applied, settles }) => (
                  <li key={rate.id} className="flex justify-between gap-3">
                    <span>
                      {rate.label} · {formatDate(rate.due_date)}
                    </span>
                    <span className={settles ? 'font-semibold text-green' : undefined}>
                      {settles
                        ? `${money(applied)} · paid`
                        : `${money(applied)} of ${money(rate.remaining)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {contract.device ? (
            <p className="m-0 border-t border-border pt-2 text-muted-foreground">
              A token for the device is generated and sent to the customer by SMS.
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-full border border-border bg-panel-2 px-3 text-sm text-foreground hover:bg-panel"
    >
      {children}
    </button>
  );
}
