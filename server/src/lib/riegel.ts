export const HALF_MARATHON_KM = 21.0975;

/**
 * Riegel race-time projection: T2 = T1 * (D2 / D1) ^ 1.06.
 *
 * @param t1Seconds duration of the reference performance, in seconds
 * @param d1Km      distance of the reference performance, in km
 * @param d2Km      target distance, in km (defaults to the half marathon)
 * @returns projected time in seconds (unrounded)
 */
export function projectRaceTime(
  t1Seconds: number,
  d1Km: number,
  d2Km: number = HALF_MARATHON_KM,
): number {
  return t1Seconds * Math.pow(d2Km / d1Km, 1.06);
}
