import { Input } from '@spark/ui/input';
import { type LucideIcon } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';

export type ComboboxItem = { key: string | number; label: string; detail?: string };

type ComboboxProps = {
  /** Accessible name of the search box. */
  label: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  icon?: LucideIcon;
  /** What the options are, plural, e.g. "villages"; used in the list's name and its messages. */
  noun: string;
  /** Shown when nothing matches, e.g. "No matching village." */
  emptyText: string;
  text: string;
  onTextChange: (text: string) => void;
  items: ComboboxItem[];
  onChoose: (index: number) => void;
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
  error?: string | null;
};

/** A search box with a list of options under it, driven by the keyboard or the pointer. */
export function Combobox({
  label,
  placeholder,
  invalid,
  className,
  icon: Icon,
  noun,
  emptyText,
  text,
  onTextChange,
  items,
  onChoose,
  onOpenChange,
  loading = false,
  error = null,
}: ComboboxProps) {
  const listId = useId();
  const [open, setOpenState] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  function choose(index: number) {
    setOpen(false);
    onChoose(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => Math.min(Math.max(index + step, 0), Math.max(items.length - 1, 0)));
    } else if (event.key === 'Enter' && open && items[activeIndex]) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      {Icon ? (
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          onTextChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          event.target.select();
          setOpen(true);
        }}
        // Choosing keeps focus in the box, so a second click has to reopen the list itself.
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`${Icon ? 'pl-9' : ''} ${invalid ? 'border-red' : ''}`}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Matching ${noun}`}
          // Keeps focus in the input, so choosing an option does not blur and close the list first.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full left-0 z-20 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-md border border-border bg-panel p-1 text-sm shadow-md"
        >
          {items.map((item, index) => (
            <li
              key={item.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => choose(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer rounded-sm px-2.5 py-2 ${index === activeIndex ? 'bg-panel-2' : ''}`}
            >
              <span className="font-semibold">{item.label}</span>
              {item.detail ? (
                <>
                  {' '}
                  <span className="text-muted-foreground">· {item.detail}</span>
                </>
              ) : null}
            </li>
          ))}
          {loading ? <li className="px-2.5 py-2 text-muted-foreground">Searching…</li> : null}
          {error ? (
            <li role="alert" className="px-2.5 py-2 text-red">
              Could not load {noun}: {error}
            </li>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <li className="px-2.5 py-2 text-muted-foreground">{emptyText}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export type SelectSearchOption = { value: string; label: string; detail?: string };

type SelectSearchProps = Omit<
  ComboboxProps,
  'text' | 'onTextChange' | 'items' | 'onChoose' | 'onOpenChange' | 'loading'
> & {
  value: string;
  onChange: (value: string) => void;
  options: SelectSearchOption[];
  /** Offered first when the field may stay empty, e.g. "Not set". */
  emptyLabel?: string;
  onBlur?: () => void;
};

/** Accents and case are ignored, so "cote" finds "Côte d'Ivoire". */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Picks one option from a list already in the browser, filtering it as the user types. */
export function SelectSearch({
  value,
  onChange,
  options,
  emptyLabel,
  onBlur,
  ...comboboxProps
}: SelectSearchProps) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? (value || emptyLabel || '');
  const [typed, setTyped] = useState<string | null>(null);

  const term = normalize(typed ?? '');
  const choices = [
    ...(emptyLabel === undefined ? [] : [{ value: '', label: emptyLabel }]),
    ...options,
  ];
  const matches =
    term === ''
      ? choices
      : choices.filter((option) =>
          normalize(`${option.label} ${option.detail ?? ''}`).includes(term),
        );

  return (
    <Combobox
      {...comboboxProps}
      text={typed ?? selectedLabel}
      onTextChange={setTyped}
      items={matches.map((option) => ({
        key: option.value,
        label: option.label,
        detail: option.detail,
      }))}
      onChoose={(index) => {
        const chosen = matches[index];
        if (chosen) {
          setTyped(null);
          onChange(chosen.value);
        }
      }}
      onOpenChange={(open) => {
        // Leaving without choosing puts the chosen option back in the box.
        if (!open) {
          setTyped(null);
          onBlur?.();
        }
      }}
    />
  );
}
