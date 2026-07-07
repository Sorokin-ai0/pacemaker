import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/workouts";
import { cn } from "@/lib/utils";

interface WeekdayPickerProps {
  /** 0 = Sunday … 6 = Saturday (JS Date.getDay convention). */
  value: number;
  onChange: (day: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Renders Monday-first for a training-week feel, but values stay 0=Sun…6=Sat. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayPicker({ value, onChange, disabled, className }: WeekdayPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Day of week"
      className={cn("grid grid-cols-7 gap-1.5", className)}
    >
      {ORDER.map((day) => {
        const selected = value === day;
        return (
          <button
            key={day}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={WEEKDAY_LABELS[day]}
            disabled={disabled}
            onClick={() => onChange(day)}
            className={cn(
              "flex h-9 items-center justify-center rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "border-primary bg-primary/15 text-primary"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {WEEKDAY_SHORT[day]}
          </button>
        );
      })}
    </div>
  );
}
