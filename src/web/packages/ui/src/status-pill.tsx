import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps } from 'react';

import { cn } from './cn';

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        success: 'bg-green/10 text-green',
        warning: 'bg-amber/10 text-amber',
        error: 'bg-red/10 text-red',
        info: 'bg-blue/10 text-blue',
        neutral: 'bg-panel-2 text-muted-foreground',
      },
    },
    defaultVariants: {
      status: 'neutral',
    },
  },
);

type StatusPillProps = ComponentProps<'span'> &
  VariantProps<typeof statusPillVariants>;

export function StatusPill({ className, status, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(statusPillVariants({ status, className }))}
      {...props}
    />
  );
}
