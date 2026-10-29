import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';

type SheetProps = {
  title: ReactNode;
  description?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
};

/**
 * A side panel that replaces stacked modals: everything a task needs, a map included,
 * lives inside one scrollable column, with the decision kept in a fixed footer.
 */
export function Sheet({ title, description, onClose, footer, children }: SheetProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col bg-panel shadow-lg focus:outline-none"
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="m-0 text-xl font-bold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid size-9 place-items-center rounded-md border border-border text-foreground hover:bg-panel-2"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">{children}</div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
