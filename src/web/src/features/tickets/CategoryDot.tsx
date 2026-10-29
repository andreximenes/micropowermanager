import { dotClassOf } from './labels';

import type { TicketCategory } from '@/api/tickets';

export function CategoryDot({ category }: { category: TicketCategory | null }) {
  if (!category) {
    return <span className="text-muted-foreground">No category</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`size-2.5 shrink-0 rounded-full ${dotClassOf(category.label_color)}`}
        aria-hidden="true"
      />
      {category.label_name}
    </span>
  );
}
