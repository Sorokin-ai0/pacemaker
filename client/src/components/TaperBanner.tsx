import { Feather } from "lucide-react";

import { cn } from "@/lib/utils";

export function TaperBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-4 py-3",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
        <Feather className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Taper time — trust the training.
        </p>
        <p className="text-sm text-indigo-700/80 dark:text-indigo-300/70">
          Volume drops from here so you arrive at the start line fresh. Resist the urge to cram.
        </p>
      </div>
    </div>
  );
}
