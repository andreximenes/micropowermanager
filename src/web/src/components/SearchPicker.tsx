import { Input } from '@spark/ui/input';
import { useQuery } from '@tanstack/react-query';
import { type LucideIcon } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';

import { useDebouncedValue } from '@/lib/useDebouncedValue';

export type Picked = { id: number; name: string };

type SearchPickerProps<Option, Value extends Picked> = {
  value: Value | null;
  onChange: (value: Value | null) => void;
  /** Accessible name of the search box. */
  label: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  icon: LucideIcon;
  /** What the options are, plural, e.g. "villages"; used in the list's name and its messages. */
  noun: string;
  /** Shown when nothing matches, e.g. "No matching village." */
  emptyText: string;
  queryKey: string;
  search: (term: string) => Promise<Option[]>;
  toValue: (option: Option) => Value;
  /** Shown after the option's name, e.g. the mini-grid a village belongs to. */
  context?: (option: Option) => string;
};

/** Searches as the user types, for lists that can run into the thousands and so are never preloaded. */
export function SearchPicker<Option, Value extends Picked>({
  value,
  onChange,
  label,
  placeholder,
  invalid,
  className,
  icon: Icon,
  noun,
  emptyText,
  queryKey,
  search,
  toValue,
  context,
}: SearchPickerProps<Option, Value>) {
  const listId = useId();
  const [text, setText] = useState(value?.name ?? '');
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const term = useDebouncedValue(text, 300);

  // A value set from outside (a cleared filter, a loaded name) replaces what was typed.
  if (value?.id !== shownValue?.id || value?.name !== shownValue?.name) {
    setShownValue(value);
    setText(value?.name ?? '');
  }

  const results = useQuery({
    queryKey: [queryKey, term],
    queryFn: () => search(term),
    enabled: open,
  });
  const options = results.data ?? [];

  function choose(option: Option) {
    const chosen = toValue(option);
    setShownValue(chosen);
    setText(chosen.name);
    setOpen(false);
    onChange(chosen);
  }

  function type(nextText: string) {
    setText(nextText);
    setOpen(true);
    setActiveIndex(0);
    if (value) {
      setShownValue(null);
      onChange(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) =>
        Math.min(Math.max(index + step, 0), Math.max(options.length - 1, 0)),
      );
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <Icon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={
          open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        placeholder={placeholder}
        value={text}
        onChange={(event) => type(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`pl-9 ${invalid ? 'border-red' : ''}`}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Matching ${noun}`}
          // Keeps focus in the input, so choosing an option does not blur and close the list first.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-panel p-1 text-sm shadow-md"
        >
          {options.map((option, index) => {
            const { id, name } = toValue(option);
            const detail = context?.(option);
            return (
              <li
                key={id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer rounded-sm px-2.5 py-2 ${index === activeIndex ? 'bg-panel-2' : ''}`}
              >
                <span className="font-semibold">{name}</span>
                {detail ? (
                  <>
                    {' '}
                    <span className="text-muted-foreground">· {detail}</span>
                  </>
                ) : null}
              </li>
            );
          })}
          {results.isPending ? (
            <li className="px-2.5 py-2 text-muted-foreground">Searching…</li>
          ) : null}
          {results.isError ? (
            <li role="alert" className="px-2.5 py-2 text-red">
              Could not load {noun}: {results.error.message}
            </li>
          ) : null}
          {results.isSuccess && options.length === 0 ? (
            <li className="px-2.5 py-2 text-muted-foreground">{emptyText}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
