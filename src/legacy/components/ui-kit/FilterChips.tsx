type Chip = {
  label: string;
  onRemove: () => void;
};

type FilterChipsProps = {
  chips: Chip[];
};

export function FilterChips({ chips }: FilterChipsProps) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="h-5 w-5 inline-flex items-center justify-center rounded-full bg-muted text-foreground/80 hover:bg-muted-foreground/10 transition"
            aria-label={`Retirer ${chip.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
