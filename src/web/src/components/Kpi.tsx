import { Card } from '@spark/ui/card';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { changeOf } from '@/lib/change';

/** A headline figure on a card, with a line under it that explains or compares it. */
export function Kpi({
  label,
  value,
  detail,
  valueClassName = '',
  className = '',
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 bg-panel px-4 py-3 sm:px-5 sm:py-4 ${className}`}>
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className={`m-0 mt-1 truncate text-lg font-bold sm:text-2xl ${valueClassName}`}>{value}</p>
      {detail}
    </Card>
  );
}

/** How the figure moved since the period it is compared with, coloured by whether that is good. */
export function KpiChange({
  current,
  past,
  changeAs,
  upIsGood,
  comparedWith,
}: {
  current: number;
  past: number;
  changeAs: 'percent' | 'count';
  upIsGood: boolean;
  comparedWith: string;
}) {
  const change = changeOf(current, past, changeAs);
  const good = change?.direction === (upIsGood ? 'up' : 'down');
  const tone =
    !change || change.direction === 'flat'
      ? 'text-muted-foreground'
      : good
        ? 'text-green'
        : 'text-red';
  return (
    <p className={`m-0 mt-0.5 flex items-center gap-1 text-xs ${tone}`}>
      {change?.direction === 'up' ? <ArrowUpRight className="size-3" aria-hidden="true" /> : null}
      {change?.direction === 'down' ? (
        <ArrowDownRight className="size-3" aria-hidden="true" />
      ) : null}
      {change ? `${change.text} vs ${comparedWith}` : `None ${comparedWith}`}
    </p>
  );
}
