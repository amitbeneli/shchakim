// Moon phase math (CLAUDE.md appendix B). Pure functions, shared by the
// scroll moon, R3 calendar, R6 widget and the booking calendar.

export const SYNODIC = 29.530588853;
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

/** Days since the last new moon, 0..29.53 */
export function moonAge(date: Date) {
  const days = (date.getTime() - REF_NEW_MOON) / 86400000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}

/** Lit fraction of the disc, 0..1 */
export const illumination = (age: number) => (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;

export const isWaxing = (age: number) => age < SYNODIC / 2;

/** "Recommended night": within ~4 days of new moon */
export const isDarkNight = (age: number) => age <= 4 || age >= 25.5;

/**
 * SVG path of the lit part of a moon of radius r centred on (0,0).
 * The lit limb is a half circle; the terminator is a half ellipse whose
 * x-radius shrinks to 0 at half moon and grows back to r at full/new.
 * Northern hemisphere: waxing moon is lit on the right.
 */
export function litPath(k: number, waxing: boolean, r: number) {
  const f = Math.min(1, Math.max(0, k));
  const rx = Math.abs(1 - 2 * f) * r;
  // Limb: top → bottom around the lit side
  const limbSweep = waxing ? 1 : 0;
  // Terminator: bottom → top, bulging toward the lit side when crescent (<½),
  // toward the dark side when gibbous (>½)
  const termSweep = (f < 0.5) === waxing ? 0 : 1;
  const top = `0 ${-r}`;
  const bottom = `0 ${r}`;
  return `M${top}A${r} ${r} 0 0 ${limbSweep} ${bottom}A${rx.toFixed(3)} ${r} 0 0 ${termSweep} ${top}Z`;
}
