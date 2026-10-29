import { type ReactNode } from 'react';

export const selectClass =
  'h-9 rounded-md border border-input-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type FieldProps = { label: string; error?: string; className?: string; children: ReactNode };

/** A labelled control; the error sits outside the label so it never becomes part of the field's name. */
export function Field({ label, error, className, children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-label">
        {label}
        {children}
      </label>
      {error ? <p className="m-0 text-xs text-red">{error}</p> : null}
    </div>
  );
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
