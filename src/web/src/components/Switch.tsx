export function Switch({
  label,
  checked,
  disabled = false,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 ${checked ? 'border-primary bg-primary' : 'border-input-border bg-panel-2'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-[18px] rounded-full shadow-sm transition-all ${checked ? 'left-[22px] bg-green-bright' : 'left-0.5 bg-panel'}`}
      />
    </button>
  );
}
