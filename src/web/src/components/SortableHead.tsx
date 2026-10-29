import { TableHead } from '@spark/ui/table';
import { ArrowDown, ArrowUp } from 'lucide-react';

type SortableHeadProps<Column extends string> = {
  column: Column;
  label: string;
  /** The list's sort: `column` ascending, `-column` descending. */
  sort: string;
  onSort: (sort: Column | `-${Column}`) => void;
  className?: string;
};

/** A column header that sorts by its column, ascending first, and flips on a second click. */
export function SortableHead<Column extends string>({
  column,
  label,
  sort,
  onSort,
  className,
}: SortableHeadProps<Column>) {
  const direction =
    sort === column ? 'ascending' : sort === `-${column}` ? 'descending' : undefined;
  return (
    <TableHead aria-sort={direction ?? 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(direction === 'ascending' ? `-${column}` : column)}
        className="inline-flex cursor-pointer items-center gap-1 font-semibold tracking-wide uppercase hover:text-foreground"
      >
        {label}
        {direction === 'ascending' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : null}
        {direction === 'descending' ? <ArrowDown className="size-3.5" aria-hidden="true" /> : null}
      </button>
    </TableHead>
  );
}
