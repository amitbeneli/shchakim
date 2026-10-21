import { describe, expect, it } from 'vitest';
import { illumination, isDarkNight, litPath, moonAge, SYNODIC } from '../src/lib/moon';
import { normalizeIsraeliMobile, validateEmail, validatePhone } from '../src/lib/validate';
import { bookedNights, isStayFree } from '../src/data/booked';
import { addDays } from '../src/lib/dates';

// Distance in days on the lunar circle (age 29.4 is 0.13 days from new moon)
const cyc = (a: number, b: number) => Math.min(Math.abs(a - b), SYNODIC - Math.abs(a - b));

describe('moon phase', () => {
  it('matches known new moons within a day', () => {
    expect(cyc(moonAge(new Date(Date.UTC(2024, 3, 8, 18, 21))), 0)).toBeLessThan(1); // eclipse
    expect(cyc(moonAge(new Date(Date.UTC(2025, 0, 29, 12, 36))), 0)).toBeLessThan(1);
  });
  it('matches a known full moon within a day', () => {
    expect(cyc(moonAge(new Date(Date.UTC(2024, 3, 23, 23, 49))), SYNODIC / 2)).toBeLessThan(1);
  });
  it('illumination runs 0 → 1 → 0 across the cycle', () => {
    expect(illumination(0)).toBeCloseTo(0);
    expect(illumination(SYNODIC / 2)).toBeCloseTo(1);
    expect(illumination(SYNODIC / 4)).toBeCloseTo(0.5);
  });
  it('flags nights near new moon as dark', () => {
    expect(isDarkNight(2)).toBe(true);
    expect(isDarkNight(27)).toBe(true);
    expect(isDarkNight(14)).toBe(false);
  });
  it('builds a valid SVG path', () => {
    expect(litPath(0.3, true, 10)).toMatch(/^M0 -10A10 10 0 0 1 0 10A[\d.]+ 10 0 0 0 0 -10Z$/);
  });
});

describe('Israeli mobile', () => {
  it.each(['050-1234567', '0501234567', '050 123 4567', '+972501234567', '972-50-123-4567'])('accepts %s', (v) => {
    expect(normalizeIsraeliMobile(v)).toBe('050-1234567');
  });
  it.each(['02-1234567', '050123456', '05012345678', 'abc', ''])('rejects %s', (v) => {
    expect(validatePhone(v)).not.toBeNull();
  });
});

describe('email', () => {
  it('accepts a normal address and rejects junk', () => {
    expect(validateEmail('dana@gmail.com')).toBeNull();
    expect(validateEmail('dana@gmail')).not.toBeNull();
    expect(validateEmail('')).not.toBeNull();
  });
});

describe('mock availability', () => {
  it('books roughly a quarter of the nights, per suite', () => {
    for (const slug of ['makhtesh', 'kochav', 'galaxia'] as const) {
      const share = bookedNights(slug).size / 400;
      expect(share).toBeGreaterThan(0.18);
      expect(share).toBeLessThan(0.32);
    }
  });
  it('is stable between calls and differs between suites', () => {
    expect([...bookedNights('kochav')]).toEqual([...bookedNights('kochav')]);
    expect([...bookedNights('kochav')]).not.toEqual([...bookedNights('makhtesh')]);
  });
  it('detects a blocked stay', () => {
    const night = [...bookedNights('makhtesh')][0];
    expect(isStayFree('makhtesh', addDays(night, -1), 2)).toBe(false);
  });
});
