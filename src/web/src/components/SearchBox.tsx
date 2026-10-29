import { Input } from '@spark/ui/input';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type SearchBoxProps = {
  term: string;
  onSearch: (term: string) => void;
  /** Accessible name of the search box. */
  label: string;
  placeholder: string;
  className?: string;
};

/** Debounces typing into the URL, so every keystroke does not become a request or a history entry. */
export function SearchBox({ term, onSearch, label, placeholder, className }: SearchBoxProps) {
  const [draft, setDraft] = useState(term);
  const [shownTerm, setShownTerm] = useState(term);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back, forward and "Clear all" change the term from outside.
  if (term !== shownTerm) {
    setShownTerm(term);
    setDraft(term);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <label className={`relative ${className ?? 'flex-[1_1_260px]'}`}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(next), 300);
        }}
        className="h-10 pl-9"
      />
    </label>
  );
}
