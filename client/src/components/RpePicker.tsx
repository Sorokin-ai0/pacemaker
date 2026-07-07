import { cn } from "@/lib/utils";

interface RpePickerProps {
  value: number | null;
  onChange: (rpe: number | null) => void;
  disabled?: boolean;
  className?: string;
}

const RPE_HINTS: Record<number, string> = {
  1: "very easy",
  2: "easy",
  3: "easy",
  4: "moderate",
  5: "moderate",
  6: "somewhat hard",
  7: "hard",
  8: "very hard",
  9: "very hard",
  10: "max effort",
};

/** Segmented 1–10 effort selector. Clicking the selected value clears it. */
export function RpePicker({ value, onChange, disabled, className }: RpePickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="radiogroup"
        aria-label="Rate of perceived exertion, 1 to 10"
        className="grid grid-cols-10 gap-1"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((rpe) => {
          const selected = value === rpe;
          return (
            <button
              key={rpe}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`RPE ${rpe} — ${RPE_HINTS[rpe]}`}
              disabled={disabled}
              onClick={() => onChange(selected ? null : rpe)}
              className={cn(
                "flex h-8 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
                selected
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {rpe}
            </button>
          );
        })}
      </div>
      <p className="min-h-4 text-xs text-muted-foreground">
        {value ? `${value} — ${RPE_HINTS[value]}` : "Optional — tap again to clear"}
      </p>
    </div>
  );
}
