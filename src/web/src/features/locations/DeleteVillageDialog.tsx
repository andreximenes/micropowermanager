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
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { deleteVillage, fetchLinkedAddresses, type Village } from '@/api/locations';
import { VillagePicker, type Village as PickedVillage } from '@/components/VillagePicker';

type DeleteVillageDialogProps = {
  village: Village;
  onDeleted: () => Promise<void>;
  onClose: () => void;
};

/**
 * Deletes a village. A village customers or agents still live in can't simply go: their
 * addresses move to another village first, in the same request.
 */
export function DeleteVillageDialog({ village, onDeleted, onClose }: DeleteVillageDialogProps) {
  const [target, setTarget] = useState<PickedVillage | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const linked = useQuery({
    queryKey: ['villages', village.id, 'addresses'],
    queryFn: () => fetchLinkedAddresses(village.id),
  });
  const total = linked.data?.total ?? 0;
  const remove = useMutation({
    mutationFn: () => deleteVillage(village.id, total > 0 ? target?.id : undefined),
    onSuccess: async () => {
      await onDeleted();
      onClose();
    },
  });
  const sameVillage = target?.id === village.id;

  function confirm() {
    if (total > 0 && (!target || sameVillage)) {
      setTargetMissing(true);
      return;
    }
    remove.mutate();
  }

  const others = total - (linked.data?.addresses.length ?? 0);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {village.name}?</DialogTitle>
          <DialogDescription>
            {total > 0
              ? `${total === 1 ? '1 address still points' : `${total} addresses still point`} to this village. They move to the village you pick, then this one is deleted.`
              : "This can't be undone."}
          </DialogDescription>
        </DialogHeader>
        {linked.isPending ? (
          <p className="m-0 text-sm text-muted-foreground">Checking who lives there…</p>
        ) : null}
        {linked.isError ? (
          <Banner tone="error" role="alert">
            Could not check the village's addresses: {linked.error.message}
          </Banner>
        ) : null}
        {total > 0 && linked.data ? (
          <div className="flex flex-col gap-3">
            <ul
              aria-label="Linked addresses"
              className="m-0 flex list-none flex-col gap-1 p-0 text-sm"
            >
              {linked.data.addresses.map((address) => (
                <li key={address.id}>
                  <strong>{address.owner_name ?? 'Unnamed'}</strong>{' '}
                  <span className="text-muted-foreground">· {address.owner_type ?? 'address'}</span>
                </li>
              ))}
              {others > 0 ? <li className="text-muted-foreground">and {others} more</li> : null}
            </ul>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-label">Move them to</span>
              <VillagePicker
                label="Village to move them to"
                placeholder="Search villages"
                value={target}
                invalid={targetMissing}
                onChange={(picked) => {
                  setTarget(picked);
                  setTargetMissing(false);
                }}
              />
              {targetMissing ? (
                <p role="alert" className="m-0 text-xs text-red">
                  {sameVillage ? 'Pick a different village.' : 'Pick the village they move to.'}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {remove.isError ? (
          <Banner tone="error" role="alert">
            The village was not deleted: {remove.error.message}
          </Banner>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!linked.data || remove.isPending}
            onClick={confirm}
          >
            {remove.isPending ? 'Deleting…' : total > 0 ? 'Move and delete' : 'Delete village'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
