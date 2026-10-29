import { Button } from '@spark/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { selectClass } from '@/components/form';
import { plural } from '@/lib/format';

type Page = {
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type PaginationProps<Size extends number> = {
  page: Page;
  /** What the list counts, singular: "customer". */
  noun: string;
  perPage: Size;
  perPageOptions: readonly Size[];
  onPage: (page: number) => void;
  onPerPage: (size: Size) => void;
};

/** The footer of a paginated list: the range shown, rows per page and previous/next. */
export function Pagination<Size extends number>({
  page,
  noun,
  perPage,
  perPageOptions,
  onPage,
  onPerPage,
}: PaginationProps<Size>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
      <span>
        {page.from}–{page.to} of {plural(page.total, noun)}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          Rows
          <select
            aria-label="Rows per page"
            className={`${selectClass} h-8 px-2`}
            value={perPage}
            onChange={(event) => onPerPage(Number(event.target.value) as Size)}
          >
            {perPageOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page.current_page <= 1}
          onClick={() => onPage(page.current_page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page.current_page >= page.last_page}
          onClick={() => onPage(page.current_page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
