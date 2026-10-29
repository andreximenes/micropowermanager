import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@spark/ui/dialog';
import { Input } from '@spark/ui/input';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ScheduledRate } from './schedule';

import { deleteContract, updateRateCost, type ContractDetail } from '@/api/contracts';
import { formatDate, formatMoney } from '@/lib/format';

type EditInstallmentDialogProps = {
  rate: ScheduledRate;
  currency: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function EditInstallmentDialog({
  rate,
  currency,
  onClose,
  onChanged,
}: EditInstallmentDialogProps) {
  const [costText, setCostText] = useState(String(rate.rate_cost));
  const newCost = costText.trim() === '' ? Number.NaN : Number(costText);
  // The backend reads the cost as an integer and does not reject negatives itself.
  const valid = Number.isInteger(newCost) && newCost >= 0;

  const update = useMutation({
    mutationFn: () => updateRateCost(rate.id, newCost),
    onSuccess: async () => {
      await onChanged();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {rate.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Due {formatDate(rate.due_date)}. Set it to 0 to remove the installment; the contract
            total changes by the same amount.
          </DialogDescription>
        </DialogHeader>
        {update.isError ? (
          <Banner tone="error" role="alert">
            The installment was not changed: {update.error.message}
          </Banner>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-label">
          Amount ({currency})
          <Input
            inputMode="numeric"
            value={costText}
            onChange={(event) => setCostText(event.target.value)}
          />
        </label>
        {!valid ? (
          <p role="alert" className="m-0 text-sm text-red">
            Enter a whole amount of 0 or more.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={newCost === 0 ? 'destructive' : 'default'}
            disabled={!valid || update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending
              ? 'Saving…'
              : newCost === 0
                ? 'Remove installment'
                : `Save ${formatMoney(newCost, currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DeleteContractDialogProps = {
  contract: ContractDetail;
  onClose: () => void;
  onDeleted: () => Promise<void>;
};

export function DeleteContractDialog({ contract, onClose, onDeleted }: DeleteContractDialogProps) {
  const remove = useMutation({
    mutationFn: () => deleteContract(contract.id),
    onSuccess: async () => {
      await onDeleted();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this contract?</DialogTitle>
          <DialogDescription>
            No more installments are collected for {contract.appliance?.name ?? 'this product'}.
            {contract.device_serial
              ? ` Device ${contract.device_serial} is released from the customer.`
              : ''}{' '}
            Payments already made stay on record.
          </DialogDescription>
        </DialogHeader>
        {remove.isError ? (
          <Banner tone="error" role="alert">
            The contract was not deleted: {remove.error.message}
          </Banner>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Deleting…' : 'Delete contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
