import type { Unit } from "@/api/types";

/**
 * ALL data coming from the API is kilometres / seconds / seconds-per-km.
 * Everything in this file converts to and from the user's display unit.
 */

export const KM_PER_MI = 1.609344;

export function unitLabel(unit: Unit): string {
  return unit === "mi" ? "mi" : "km";
}

/** km (API) → value in the user's display unit. */
export function kmToUnit(km: number, unit: Unit): number {
  return unit === "mi" ? km / KM_PER_MI : km;
}

/** value typed by the user (display unit) → km for the API. */
export function unitToKm(value: number, unit: Unit): number {
  const km = unit === "mi" ? value * KM_PER_MI : value;
  return Math.round(km * 1000) / 1000;
}

/** "6.2 mi" / "10.0 km" — one decimal by default. */
export function formatDistance(
  km: number,
  unit: Unit,
  opts: { withUnit?: boolean; decimals?: number } = {},
): string {
  const { withUnit = true, decimals = 1 } = opts;
  const value = kmToUnit(km, unit).toFixed(decimals);
  return withUnit ? `${value} ${unitLabel(unit)}` : value;
}

/** seconds-per-km (API) → seconds per display unit. */
export function paceSecPerUnit(secPerKm: number, unit: Unit): number {
  return unit === "mi" ? secPerKm * KM_PER_MI : secPerKm;
}

/** m:ss for a pace expressed in seconds (already per display unit). */
export function formatPaceClock(secPerUnit: number): string {
  const total = Math.round(secPerUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** "8:35 /mi" — from an API pace in sec-per-km. */
export function formatPace(secPerKm: number, unit: Unit): string {
  return `${formatPaceClock(paceSecPerUnit(secPerKm, unit))} /${unitLabel(unit)}`;
}

/** "7.4 mph" / "11.9 km/h" — same underlying pace, shown as speed. */
export function formatSpeed(secPerKm: number, unit: Unit): string {
  const unitsPerHour = 3600 / paceSecPerUnit(secPerKm, unit);
  return `${unitsPerHour.toFixed(1)} ${unit === "mi" ? "mph" : "km/h"}`;
}

/** Pace or speed per the display preference (see Settings → Display). */
export function formatPaceOrSpeed(secPerKm: number, unit: Unit, showSpeed: boolean): string {
  return showSpeed ? formatSpeed(secPerKm, unit) : formatPace(secPerKm, unit);
}

/** "1:45:30" when ≥ 1h, otherwise "45:30". */
export function formatDuration(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Always h:mm:ss — used for projected finish times. */
export function formatFinishTime(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
