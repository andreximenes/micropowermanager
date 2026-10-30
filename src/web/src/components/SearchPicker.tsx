import { useQuery } from '@tanstack/react-query';
import { type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { Combobox } from './Combobox';

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
  queryKey,
  search,
  toValue,
  context,
  ...comboboxProps
}: SearchPickerProps<Option, Value>) {
  const [text, setText] = useState(value?.name ?? '');
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
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

  return (
    <Combobox
      {...comboboxProps}
      text={text}
      onTextChange={(nextText) => {
        setText(nextText);
        if (value) {
          setShownValue(null);
          onChange(null);
        }
      }}
      items={options.map((option) => {
        const { id, name } = toValue(option);
        return { key: id, label: name, detail: context?.(option) };
      })}
      onChoose={(index) => {
        const option = options[index];
        if (option === undefined) {
          return;
        }
        const chosen = toValue(option);
        setShownValue(chosen);
        setText(chosen.name);
        onChange(chosen);
      }}
      onOpenChange={setOpen}
      loading={open && results.isPending}
      error={results.isError ? results.error.message : null}
    />
  );
}
