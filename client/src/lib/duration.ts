export interface DurationParts {
  h: string;
  m: string;
  s: string;
}

export function durationPartsToSeconds(parts: DurationParts): number {
  const h = parseInt(parts.h, 10) || 0;
  const m = parseInt(parts.m, 10) || 0;
  const s = parseInt(parts.s, 10) || 0;
  return h * 3600 + m * 60 + s;
}

export function secondsToDurationParts(totalSeconds: number): DurationParts {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h: h > 0 ? String(h) : "", m: String(m), s: String(s) };
}
