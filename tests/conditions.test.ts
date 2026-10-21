import { describe, expect, it } from 'vitest';
import { averageCloud, rate, tonightHours } from '../src/lib/conditions';

const mk = (date: string, next: string, cloud: (h: string) => number | null) => {
  const time: string[] = [];
  const cc: (number | null)[] = [];
  for (const d of [date, next])
    for (let h = 0; h < 24; h++) {
      const t = `${d}T${String(h).padStart(2, '0')}:00`;
      time.push(t);
      cc.push(cloud(t));
    }
  return { hourly: { time, cloud_cover: cc } };
};

describe('R6 conditions', () => {
  it('uses 21:00–03:00 across midnight', () => {
    expect(tonightHours('2026-12-31')).toEqual([
      '2026-12-31T21:00', '2026-12-31T22:00', '2026-12-31T23:00',
      '2027-01-01T00:00', '2027-01-01T01:00', '2027-01-01T02:00', '2027-01-01T03:00',
    ]);
  });
  it('averages only tonight’s hours', () => {
    // daytime is fully cloudy, the night is 10%: daytime must not leak in
    const data = mk('2026-11-12', '2026-11-13', (t) => (/T(2[1-3]|0[0-3]):/.test(t) ? 10 : 100));
    expect(averageCloud(data, '2026-11-12')).toBe(10);
  });
  it('skips nulls and refuses to guess with too little data', () => {
    const some = mk('2026-11-12', '2026-11-13', (t) => (t.endsWith('T22:00') || t.endsWith('T01:00') ? null : 30));
    expect(averageCloud(some, '2026-11-12')).toBe(30);
    const none = mk('2026-11-12', '2026-11-13', () => null);
    expect(averageCloud(none, '2026-11-12')).toBeNull();
  });
  it('rates by the published rule', () => {
    expect(rate(10, 20)).toBe('excellent');
    expect(rate(10, 50)).toBe('good');
    expect(rate(30, 20)).toBe('good');
    expect(rate(49, 74)).toBe('good');
    expect(rate(50, 10)).toBe('weak');
    expect(rate(10, 80)).toBe('weak');
  });
});
