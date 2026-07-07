import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { Unit, WeeklyMileagePointDTO } from "@/api/types";
import { useTheme } from "@/context/theme";
import { kmToUnit, unitLabel } from "@/lib/units";

interface WeeklyMileageChartProps {
  weeks: WeeklyMileagePointDTO[];
  unit: Unit;
}

interface WeekRow {
  weekStart: string;
  label: string;
  planned: number;
  logged: number;
  isCurrent: boolean;
}

const CHART_COLORS = {
  dark: {
    logged: "#0a95d8",
    loggedCurrent: "#38bdf8",
    planned: "#66779c",
    grid: "rgba(148, 163, 184, 0.12)",
    tick: "#8b96ab",
  },
  light: {
    logged: "#0369a1",
    loggedCurrent: "#0284c7",
    planned: "#64748b",
    grid: "rgba(100, 116, 139, 0.18)",
    tick: "#64748b",
  },
};

function MileageTooltip({ active, payload, unit }: TooltipProps<number, string> & { unit: Unit }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as WeekRow;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">
        Week of {format(parseISO(row.weekStart), "MMM d")}
        {row.isCurrent && <span className="ml-1 text-primary">· this week</span>}
      </p>
      <p className="mt-1 text-muted-foreground">
        Planned{" "}
        <span className="font-medium text-foreground tabular-nums">
          {row.planned.toFixed(1)} {unitLabel(unit)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Logged{" "}
        <span className="font-medium text-foreground tabular-nums">
          {row.logged.toFixed(1)} {unitLabel(unit)}
        </span>
      </p>
    </div>
  );
}

export function WeeklyMileageChart({ weeks, unit }: WeeklyMileageChartProps) {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const data = useMemo<WeekRow[]>(() => {
    const now = new Date();
    return weeks.map((w, i) => {
      const start = parseISO(w.weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return {
        weekStart: w.weekStart,
        label: `W${i + 1}`,
        planned: Math.round(kmToUnit(w.plannedKm, unit) * 10) / 10,
        logged: Math.round(kmToUnit(w.loggedKm, unit) * 10) / 10,
        isCurrent: now >= start && now < end,
      };
    });
  }, [weeks, unit]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px] border"
            style={{ borderColor: colors.planned, backgroundColor: `${colors.planned}40` }}
            aria-hidden="true"
          />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: colors.logged }}
            aria-hidden="true"
          />
          Logged
        </span>
      </div>
      <div
        className="h-64"
        role="img"
        aria-label={`Weekly mileage chart: planned versus logged ${unitLabel(unit)} per training week`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: colors.tick }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: colors.tick }}
              tickFormatter={(v: number) => String(v)}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              content={(props: TooltipProps<number, string>) => (
                <MileageTooltip {...props} unit={unit} />
              )}
            />
            <Bar
              dataKey="planned"
              name="Planned"
              fill={colors.planned}
              fillOpacity={0.3}
              stroke={colors.planned}
              strokeOpacity={0.55}
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Bar dataKey="logged" name="Logged" radius={[4, 4, 0, 0]} maxBarSize={22}>
              {data.map((row) => (
                <Cell
                  key={row.weekStart}
                  fill={row.isCurrent ? colors.loggedCurrent : colors.logged}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
