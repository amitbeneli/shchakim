import { describe, expect, it } from 'vitest';
import { checkCoupon, quote, stayError } from '../src/lib/pricing';
import { weekday } from '../src/lib/dates';

// 2026-11-12 is a Thursday
const THU = '2026-11-12';
const FRI = '2026-11-13';
const SAT = '2026-11-14';
const SUN = '2026-11-15';

const ok = (r: ReturnType<typeof quote>) => {
  if (!r.ok) throw new Error(r.errors.join(' | '));
  return r.quote;
};

describe('fixtures', () => {
  it('uses the weekdays we think it does', () => {
    expect([THU, FRI, SAT, SUN].map(weekday)).toEqual([4, 5, 6, 0]);
  });
});

describe('brief acceptance test', () => {
  // Kochav suite, Thursday check-in, 2 nights, 2 guests, guided stargazing ×2, STARS10
  const q = ok(
    quote({ suite: 'kochav', checkIn: THU, nights: 2, guests: 2, addons: [{ id: 'astronomer', qty: 2 }], coupon: 'STARS10' }),
  );

  it('prices Thursday and Friday nights at +20%', () => {
    expect(q.nights.map((n) => n.total)).toEqual([226800, 226800]); // 2,268 ₪ each
  });
  it('takes 10% off lodging only', () => {
    expect(q.discount).toBe(45360); // −453.60 ₪
  });
  it('adds the stargazing for two', () => {
    expect(q.addonsTotal).toBe(36000); // 360 ₪
  });
  it('totals 4,442.40 ₪ with 677.65 ₪ VAT', () => {
    expect(q.total).toBe(444240);
    expect(q.vat).toBe(67765);
  });
  it('checks out on Saturday', () => {
    expect(q.checkOut).toBe(SAT);
  });
});

describe('weekend surcharge', () => {
  it('does not apply on Saturday night (clarified with the client)', () => {
    const q = ok(quote({ suite: 'makhtesh', checkIn: SAT, nights: 1, guests: 2 }));
    expect(q.nights[0].surcharge).toBe(0);
    expect(q.total).toBe(145000);
  });
  it('does not apply mid-week', () => {
    const q = ok(quote({ suite: 'makhtesh', checkIn: SUN, nights: 3, guests: 1 }));
    expect(q.lodging).toBe(3 * 145000);
  });
});

describe('stay length', () => {
  it('requires 2 nights when the stay includes Thursday', () => {
    expect(stayError(THU, 1)).toMatch(/לפחות 2 לילות/);
  });
  it('requires 2 nights when the stay includes Friday', () => {
    expect(stayError(FRI, 1)).toMatch(/לפחות 2 לילות/);
  });
  it('allows a single Saturday or weekday night', () => {
    expect(stayError(SAT, 1)).toBeNull();
    expect(stayError(SUN, 1)).toBeNull();
  });
  it('allows Wednesday + Thursday (2 nights)', () => {
    expect(stayError('2026-11-11', 2)).toBeNull();
  });
  it('caps a booking at 7 nights', () => {
    expect(stayError(SUN, 7)).toBeNull();
    expect(stayError(SUN, 8)).toMatch(/עד 7/);
  });
  it('rejects zero nights and bad dates', () => {
    expect(stayError(SUN, 0)).not.toBeNull();
    expect(stayError('not-a-date', 2)).not.toBeNull();
  });
});

describe('coupon', () => {
  it('is case-insensitive and ignores spaces', () => {
    expect(checkCoupon('  stars10 ')).toBe('valid');
    expect(checkCoupon('Stars10')).toBe('valid');
  });
  it('treats empty as no coupon', () => {
    expect(checkCoupon('')).toBe('none');
    expect(checkCoupon(undefined)).toBe('none');
  });
  it('rejects a wrong code with a clear message', () => {
    const r = quote({ suite: 'kochav', checkIn: SUN, nights: 1, guests: 2, coupon: 'STARS20' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/לא תקף/);
  });
  it('never discounts add-ons', () => {
    const q = ok(
      quote({ suite: 'makhtesh', checkIn: SUN, nights: 1, guests: 2, addons: [{ id: 'dinner', qty: 2 }], coupon: 'STARS10' }),
    );
    expect(q.discount).toBe(14500);
    expect(q.addonsTotal).toBe(58000);
  });
  it('TEST100 zeroes the lodging (add-ons still charged)', () => {
    const q = ok(
      quote({ suite: 'makhtesh', checkIn: SUN, nights: 1, guests: 2, addons: [{ id: 'dinner', qty: 2 }], coupon: ' test100 ' }),
    );
    expect(q.discount).toBe(q.lodging);
    expect(q.total).toBe(58000);
  });
});

describe('guests and add-ons', () => {
  it('blocks more guests than the suite holds', () => {
    expect(quote({ suite: 'kochav', checkIn: SUN, nights: 1, guests: 3 }).ok).toBe(false);
    expect(quote({ suite: 'galaxia', checkIn: SUN, nights: 1, guests: 4 }).ok).toBe(true);
  });
  it('charges per-booking add-ons once, whatever the quantity', () => {
    const q = ok(quote({ suite: 'galaxia', checkIn: SUN, nights: 1, guests: 4, addons: [{ id: 'photo', qty: 4 }] }));
    expect(q.addonsTotal).toBe(45000);
  });
  it('ignores zero quantities and unknown add-ons', () => {
    const q = ok(
      quote({ suite: 'galaxia', checkIn: SUN, nights: 1, guests: 2, addons: [{ id: 'jeep', qty: 0 }, { id: 'nope' as never, qty: 3 }] }),
    );
    expect(q.addons).toHaveLength(0);
  });
  it('keeps money in whole agorot', () => {
    const q = ok(quote({ suite: 'galaxia', checkIn: THU, nights: 7, guests: 4, coupon: 'stars10', addons: [{ id: 'jeep', qty: 3 }] }));
    for (const v of [q.lodging, q.discount, q.addonsTotal, q.total, q.vat]) expect(Number.isInteger(v)).toBe(true);
  });
});
