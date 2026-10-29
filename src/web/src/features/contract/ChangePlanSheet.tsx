import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import {
  previewPlanChange,
  unpaidRates,
  type PlanChangePreview,
  type ScheduledRate,
} from './schedule';

import { changePlan, type ContractDetail } from '@/api/contracts';
import { Sheet } from '@/components/Sheet';
import { formatDate, formatMoney } from '@/lib/format';

type ChangePlanSheetProps = {
  contract: ContractDetail;
  schedule: ScheduledRate[];
  currency: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

const selectClass =
  'h-9 rounded-md border border-input-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const numberOf = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-label">
      {label}
      {children}
    </label>
  );
}

export function ChangePlanSheet({
  contract,
  schedule,
  currency,
  onClose,
  onChanged,
}: ChangePlanSheetProps) {
  const [totalCost, setTotalCost] = useState(String(contract.total_cost));
  const [rateCount, setRateCount] = useState(String(unpaidRates(schedule).length));
  const [rateType, setRateType] = useState(contract.rateType);

  const preview = previewPlanChange(contract, schedule, {
    newTotalCost: numberOf(totalCost),
    rateCount: numberOf(rateCount),
    rateType,
  });
  const money = (value: number) => formatMoney(value, currency);

  const change = useMutation({
    mutationFn: (plan: PlanChangePreview) =>
      changePlan(contract.id, {
        newTotalCost: plan.paid + plan.outstanding,
        // The backend ignores a new cadence without a count, and assumes monthly for a count
        // without a cadence, so the two always travel together.
        schedule: plan.reschedules ? { rateCount: plan.rateCount, rateType } : undefined,
      }),
    onSuccess: async () => {
      await onChanged();
      onClose();
    },
  });

  return (
    <Sheet
      title="Change plan"
      description={contract.appliance?.name ?? undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={typeof preview === 'string' || change.isPending}
            onClick={() => (typeof preview === 'string' ? undefined : change.mutate(preview))}
          >
            {change.isPending ? 'Saving…' : 'Save new plan'}
          </Button>
        </>
      }
    >
      {change.isError ? (
        <Banner tone="error" role="alert">
          The plan was not changed: {change.error.message}
        </Banner>
      ) : null}

      <p className="m-0 text-sm text-muted-foreground">
        Installments already paid, in full or in part, stay as they are. The rest of the price is
        spread over the installments below.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Total price">
          <Input
            inputMode="numeric"
            value={totalCost}
            onChange={(event) => setTotalCost(event.target.value)}
          />
        </Field>
        <Field label="Installments left">
          <Input
            inputMode="numeric"
            value={rateCount}
            onChange={(event) => setRateCount(event.target.value)}
          />
        </Field>
        <Field label="Frequency">
          <select
            className={selectClass}
            value={rateType}
            onChange={(event) => setRateType(event.target.value as 'monthly' | 'weekly')}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
      </div>

      {typeof preview === 'string' ? (
        <p role="alert" className="m-0 text-sm text-red">
          {preview}
        </p>
      ) : (
        <dl
          aria-label="New plan"
          className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg bg-panel-2 px-4 py-3.5 text-sm"
        >
          <dt className="text-muted-foreground">Already paid</dt>
          <dd className="m-0 font-semibold">{money(preview.paid)}</dd>
          <dt className="text-muted-foreground">Left to pay</dt>
          <dd className="m-0 font-semibold">{money(preview.outstanding)}</dd>
          <dt className="text-muted-foreground">Each installment</dt>
          <dd className="m-0 font-semibold">
            {money(preview.installment)}
            {preview.lastInstallment !== preview.installment
              ? `, last ${money(preview.lastInstallment)}`
              : ''}
          </dd>
          <dt className="text-muted-foreground">Paid off</dt>
          <dd className="m-0 font-semibold">{formatDate(preview.paidOffBy)}</dd>
        </dl>
      )}
    </Sheet>
  );
}
