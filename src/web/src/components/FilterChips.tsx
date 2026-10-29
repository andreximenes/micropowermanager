import { X } from 'lucide-react';

export type FilterChip = { key: string; label: string; onRemove: () => void };

/** The filters a list is narrowed by, each removable, with a way to drop them all. */
export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-sm sm:px-5">
      <span className="text-muted-foreground">Filtered by</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-1 pr-1 pl-3"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter ${chip.label}`}
            onClick={chip.onRemove}
            className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-border"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="cursor-pointer p-1 underline">
        Clear all
      </button>
    </div>
  );
}
