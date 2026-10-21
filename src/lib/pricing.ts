// Booking price engine (CLAUDE.md §5). Pure: no DOM, no clock, fully tested.
// All money is integer agorot (1 ₪ = 100) to avoid floating-point drift;
// rounding happens once per line, and only for display do we divide by 100.

import { addons as ADDONS, getSuite, pricingConfig as CFG, type Addon, type SuiteSlug } from '../data/pricing';
import { addDays, isISODate, weekday, type ISODate } from './dates';

export interface AddonPick {
  id: Addon['id'];
  qty: number;
}

export interface QuoteInput {
  suite: SuiteSlug;
  checkIn: ISODate;
  nights: number;
  guests: number;
  addons?: AddonPick[];
  coupon?: string;
}

export interface NightLine {
  date: ISODate;
  weekday: number;
  base: number; // agorot
  surcharge: number; // agorot
  total: number; // agorot
}

export interface AddonLine {
  id: Addon['id'];
  name: string;
  qty: number;
  unit: number; // agorot
  total: number; // agorot
  perPerson: boolean;
}

export interface Quote {
  checkOut: ISODate;
  nights: NightLine[];
  lodging: number;
  discount: number;
  couponApplied: boolean;
  addons: AddonLine[];
  addonsTotal: number;
  total: number;
  vat: number;
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; errors: string[] };

const ag = (shekels: number) => Math.round(shekels * 100);

export const normalizeCoupon = (c?: string) => (c ?? '').trim().toUpperCase();

/** '' → no coupon; valid → true; anything else → false */
export function checkCoupon(c?: string): 'none' | 'valid' | 'invalid' {
  const n = normalizeCoupon(c);
  if (!n) return 'none';
  return n === CFG.coupon.code ? 'valid' : 'invalid';
}

export const couponError = 'הקוד שהוזן לא תקף. אפשר לנסות שוב או להמשיך בלי קוד.';

/** Stay-length rules. Returns a Hebrew message, or null when the stay is valid. */
export function stayError(checkIn: ISODate, nights: number): string | null {
  if (!isISODate(checkIn)) return 'יש לבחור תאריך הגעה.';
  if (!Number.isInteger(nights) || nights < 1) return 'יש לבחור לפחות לילה אחד.';
  if (nights > CFG.maxNights) return `אפשר להזמין עד ${CFG.maxNights} לילות בהזמנה אחת.`;
  const touchesWeekend = Array.from({ length: nights }, (_, i) => weekday(addDays(checkIn, i))).some((d) =>
    CFG.weekendNights.includes(d),
  );
  if (touchesWeekend && nights < CFG.minWeekendNights)
    return `הזמנה שכוללת לילה של חמישי או שישי היא לפחות ${CFG.minWeekendNights} לילות.`;
  return null;
}

export function quote(input: QuoteInput): QuoteResult {
  const errors: string[] = [];
  const suite = getSuite(input.suite);
  if (!suite) errors.push('יש לבחור סוויטה.');

  const stay = stayError(input.checkIn, input.nights);
  if (stay) errors.push(stay);

  if (suite && (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > suite.maxGuests))
    errors.push(`${suite.name} מתאימה לעד ${suite.maxGuests} אורחים.`);

  const coupon = checkCoupon(input.coupon);
  if (coupon === 'invalid') errors.push(couponError);

  if (errors.length || !suite) return { ok: false, errors };

  // Lodging: one line per night; Thursday/Friday nights carry the surcharge
  const nights: NightLine[] = Array.from({ length: input.nights }, (_, i) => {
    const date = addDays(input.checkIn, i);
    const wd = weekday(date);
    const base = ag(suite.nightly);
    const surcharge = CFG.surchargeWeekdays.includes(wd) ? Math.round(base * CFG.surchargeRate) : 0;
    return { date, weekday: wd, base, surcharge, total: base + surcharge };
  });
  const lodging = nights.reduce((s, n) => s + n.total, 0);

  // STARS10: on lodging only (after the weekend surcharge), never on add-ons
  const couponApplied = coupon === 'valid';
  const discount = couponApplied ? Math.round(lodging * CFG.coupon.rate) : 0;

  const addonLines: AddonLine[] = [];
  for (const pick of input.addons ?? []) {
    const a = ADDONS.find((x) => x.id === pick.id);
    const qty = Math.max(0, Math.floor(pick.qty));
    if (!a || qty === 0) continue;
    const perPerson = a.pricing === 'perPerson';
    const units = perPerson ? qty : 1; // per-booking add-ons are bought once
    addonLines.push({ id: a.id, name: a.name, qty: units, unit: ag(a.price), total: ag(a.price) * units, perPerson });
  }
  const addonsTotal = addonLines.reduce((s, l) => s + l.total, 0);

  const total = lodging - discount + addonsTotal;
  // Prices include VAT, so the VAT share is total × 18/118
  const vatPct = Math.round(CFG.vatRate * 100); // 18, as an integer to keep the math exact
  const vat = Math.round((total * vatPct) / (100 + vatPct));

  return {
    ok: true,
    quote: {
      checkOut: addDays(input.checkIn, input.nights),
      nights,
      lodging,
      discount,
      couponApplied,
      addons: addonLines,
      addonsTotal,
      total,
      vat,
    },
  };
}

/** agorot → shekels number, for display/formatting only */
export const shekels = (agorot: number) => agorot / 100;
