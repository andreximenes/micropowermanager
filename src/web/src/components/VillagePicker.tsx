import { Input } from '@spark/ui/input';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';

import { searchCities, type City } from '@/api/people';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export type Village = { id: number; name: string };

type VillagePickerProps = {
  value: Village | null;
  onChange: (village: Village | null) => void;
  /** Accessible name of the search box. */
  label: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
};

function villageContext(city: City): string {
  return [city.mini_grid?.name, city.mini_grid?.cluster?.name].filter(Boolean).join(' · ');
}

/** Searches villages as the user types; villages can run into the thousands, so none are preloaded. */
export function VillagePicker({
  value,
  onChange,
  label,
  placeholder,
  invalid,
  className,
}: VillagePickerProps) {
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

  const cities = useQuery({
    queryKey: ['cities', term],
    queryFn: () => searchCities(term),
    enabled: open,
  });
  const options = cities.data ?? [];

  function choose(city: City) {
    const village = { id: city.id, name: city.name };
    setShownValue(village);
    setText(city.name);
    setOpen(false);
    onChange(village);
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
      <MapPin
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
          aria-label="Matching villages"
          // Keeps focus in the input, so choosing an option does not blur and close the list first.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-panel p-1 text-sm shadow-md"
        >
          {options.map((city, index) => (
            <li
              key={city.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => choose(city)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer rounded-sm px-2.5 py-2 ${index === activeIndex ? 'bg-panel-2' : ''}`}
            >
              <span className="font-semibold">{city.name}</span>
              {villageContext(city) ? (
                <>
                  {' '}
                  <span className="text-muted-foreground">· {villageContext(city)}</span>
                </>
              ) : null}
            </li>
          ))}
          {cities.isPending ? (
            <li className="px-2.5 py-2 text-muted-foreground">Searching…</li>
          ) : null}
          {cities.isError ? (
            <li role="alert" className="px-2.5 py-2 text-red">
              Could not load villages: {cities.error.message}
            </li>
          ) : null}
          {cities.isSuccess && options.length === 0 ? (
            <li className="px-2.5 py-2 text-muted-foreground">No matching village.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
