import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { PaceTrendPointDTO, Unit } from "@/api/types";
import { useTheme } from "@/context/theme";
import { formatDistance, formatPaceClock, paceSecPerUnit, unitLabel } from "@/lib/units";

interface PaceTrendChartProps {
  points: PaceTrendPointDTO[];
  unit: Unit;
}

interface PaceRow {
  date: string;
  /** Seconds per display unit — already converted. */
  pace: number;
  distanceKm: number;
}

const CHART_COLORS = {
  dark: {
    line: "#38bdf8",
    grid: "rgba(148, 163, 184, 0.12)",
    tick: "#8b96ab",
  },
  light: {
    line: "#0284c7",
    grid: "rgba(100, 116, 139, 0.18)",
    tick: "#64748b",
  },
};

function PaceTooltip({ active, payload, unit }: TooltipProps<number, string> & { unit: Unit }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as PaceRow;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{format(parseISO(row.date), "EEE, MMM d")}</p>
      <p className="mt-1 text-muted-foreground">
        Pace{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatPaceClock(row.pace)} /{unitLabel(unit)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Distance{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatDistance(row.distanceKm, unit)}
        </span>
      </p>
    </div>
  );
}

export function PaceTrendChart({ points, unit }: PaceTrendChartProps) {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const data = useMemo<PaceRow[]>(
    () =>
      points.map((p) => ({
        date: p.date,
        pace: Math.round(paceSecPerUnit(p.paceSecPerKm, unit)),
        distanceKm: p.distanceKm,
      })),
    [points, unit],
  );

  return (
    <div
      className="h-64"
      role="img"
      aria-label={`Pace trend chart in minutes per ${unitLabel(unit)} — lower on the chart is slower, higher is faster`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: colors.tick }}
            tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
            minTickGap={24}
          />
          <YAxis
            reversed
            domain={[
              (dataMin: number) => Math.max(0, dataMin - 15),
              (dataMax: number) => dataMax + 15,
            ]}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: colors.tick }}
            tickFormatter={(v: number) => formatPaceClock(v)}
          />
          <Tooltip
            cursor={{ stroke: colors.tick, strokeDasharray: "3 3" }}
            content={(props: TooltipProps<number, string>) => (
              <PaceTooltip {...props} unit={unit} />
            )}
          />
          <Line
            type="monotone"
            dataKey="pace"
            name="Pace"
            stroke={colors.line}
            strokeWidth={2}
            dot={data.length <= 40 ? { r: 2.5, fill: colors.line, strokeWidth: 0 } : false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
