import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  icon?: LucideIcon;
  /** Big headline value — rendered with tabular numerals. */
  value: ReactNode;
  /** Secondary line under the value. */
  sub?: ReactNode;
  /** Extra content below (progress bar, etc.). */
  children?: ReactNode;
  className?: string;
}

export function StatCard({ title, icon: Icon, value, sub, children, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tracking-tight tabular-nums")}>{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {children}
      </CardContent>
    </Card>
  );
}
