// Availability per suite.
// - Live: the "זמינות" tab of the bookings Google Sheet, read through the same Apps Script
//   (GET ?action=availability). The owner edits it from the admin page; approving a
//   booking there blocks its nights.
// - Fallback (no endpoint, offline, or the request fails): a seeded PRNG demo list,
//   ~25% of nights, stable across visits and builds.

import type { SuiteSlug } from './pricing';
import { addDays, type ISODate } from '../lib/dates';

/** mulberry32: tiny, fast, deterministic PRNG */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS: Record<SuiteSlug, number> = { makhtesh: 1101, kochav: 2202, galaxia: 3303 };
const START: ISODate = '2026-10-01';
const DAYS = 400;
const RATE = 0.25;
// Runs average 2 nights, so a run must start with p where 2p / (2p + (1 − p)) = RATE
const START_P = RATE / (2 - RATE);

function build(slug: SuiteSlug): Set<ISODate> {
  const rnd = mulberry32(SEEDS[slug]);
  const set = new Set<ISODate>();
  // Bookings come in short runs (1–3 nights), like real reservations
  for (let i = 0; i < DAYS; ) {
    if (rnd() < START_P) {
      const len = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < len && i < DAYS; j++, i++) set.add(addDays(START, i));
    } else i++;
  }
  return set;
}

const cache = new Map<SuiteSlug, Set<ISODate>>();
let live: Record<SuiteSlug, Set<ISODate>> | null = null;

export function bookedNights(slug: SuiteSlug): Set<ISODate> {
  if (live) return live[slug];
  if (!cache.has(slug)) cache.set(slug, build(slug));
  return cache.get(slug)!;
}

/** Where the calendar's availability came from */
export const availabilitySource = () => (live ? 'live' : 'demo');

const ENDPOINT = import.meta.env.PUBLIC_LEAD_ENDPOINT as string | undefined;
let loading: Promise<boolean> | null = null;

/** Load live availability once per page; resolves true if it replaced the demo list */
export function loadAvailability(timeoutMs = 8000): Promise<boolean> {
  if (!ENDPOINT) return Promise.resolve(false);
  if (loading) return loading;
  loading = (async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(`${ENDPOINT}?action=availability`, { signal: ac.signal });
      const data = (await res.json()) as { ok?: boolean; blocked?: Record<string, string[]> };
      if (!data.ok || !data.blocked) return false;
      const set = (k: SuiteSlug) => new Set<ISODate>((data.blocked![k] ?? []) as ISODate[]);
      live = { makhtesh: set('makhtesh'), kochav: set('kochav'), galaxia: set('galaxia') };
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  })();
  return loading;
}

export const isBooked = (slug: SuiteSlug, date: ISODate) => bookedNights(slug).has(date);

/** True if every night of the stay is free in this suite */
export function isStayFree(slug: SuiteSlug, checkIn: ISODate, nights: number) {
  for (let i = 0; i < nights; i++) if (isBooked(slug, addDays(checkIn, i))) return false;
  return true;
}
