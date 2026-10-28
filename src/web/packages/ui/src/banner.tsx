import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps } from 'react';

import { cn } from './cn';

const bannerVariants = cva(
  'rounded-md border p-3 pl-4 text-sm [border-left-width:4px]',
  {
    variants: {
      tone: {
        info: 'border-banner-line bg-banner text-banner-ink',
        success: 'border-green bg-green/10 text-green',
        warning: 'border-amber bg-amber/10 text-amber',
        error: 'border-red bg-red/10 text-red',
      },
    },
    defaultVariants: {
      tone: 'info',
    },
  },
);

type BannerProps = ComponentProps<'div'> & VariantProps<typeof bannerVariants>;

// A callout for one short explanation or result — not a toast, it stays put.
export function Banner({ className, tone, ...props }: BannerProps) {
  return <div className={cn(bannerVariants({ tone, className }))} {...props} />;
}
