import { Input } from "@/components/ui/input";
import type { DurationParts } from "@/lib/duration";
import { cn } from "@/lib/utils";

interface DurationInputProps {
  value: DurationParts;
  onChange: (value: DurationParts) => void;
  disabled?: boolean;
  className?: string;
  /** id prefix so external labels can point at the hours field. */
  idPrefix?: string;
}

/** hh : mm : ss duration entry. */
export function DurationInput({
  value,
  onChange,
  disabled,
  className,
  idPrefix = "duration",
}: DurationInputProps) {
  const set = (part: keyof DurationParts, raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, part === "h" ? 2 : 2);
    onChange({ ...value, [part]: digits });
  };

  const fieldClass = "w-16 text-center tabular-nums";

  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-h`} className="block text-xs text-muted-foreground">
          hrs
        </label>
        <Input
          id={`${idPrefix}-h`}
          inputMode="numeric"
          placeholder="0"
          value={value.h}
          onChange={(e) => set("h", e.target.value)}
          disabled={disabled}
          className={fieldClass}
        />
      </div>
      <span className="pb-2 text-muted-foreground">:</span>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-m`} className="block text-xs text-muted-foreground">
          min
        </label>
        <Input
          id={`${idPrefix}-m`}
          inputMode="numeric"
          placeholder="00"
          value={value.m}
          onChange={(e) => set("m", e.target.value)}
          disabled={disabled}
          className={fieldClass}
        />
      </div>
      <span className="pb-2 text-muted-foreground">:</span>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-s`} className="block text-xs text-muted-foreground">
          sec
        </label>
        <Input
          id={`${idPrefix}-s`}
          inputMode="numeric"
          placeholder="00"
          value={value.s}
          onChange={(e) => set("s", e.target.value)}
          disabled={disabled}
          className={fieldClass}
        />
      </div>
    </div>
  );
}
