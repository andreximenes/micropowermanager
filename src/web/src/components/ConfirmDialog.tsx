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
import { useMutation } from '@tanstack/react-query';
import { type ReactNode } from 'react';

type ConfirmDialogProps = {
  title: string;
  description: ReactNode;
  /** The button's label, e.g. "Delete product"; it reads "Deleting…" style text while pending. */
  confirmLabel: string;
  pendingLabel: string;
  /** Shown before the server's message when the action fails, e.g. "The product was not deleted". */
  failureLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown>;
  /** Runs after `onConfirm` succeeds, before the dialog closes. */
  onDone: () => Promise<void> | void;
  onClose: () => void;
};

/** Asks before an action that cannot be taken back, and keeps the server's refusal in view. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  failureLabel,
  destructive = true,
  onConfirm,
  onDone,
  onClose,
}: ConfirmDialogProps) {
  const action = useMutation({
    mutationFn: onConfirm,
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {action.isError ? (
          <Banner tone="error" role="alert">
            {failureLabel}: {action.error.message}
          </Banner>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={action.isPending}
            onClick={() => action.mutate()}
          >
            {action.isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
