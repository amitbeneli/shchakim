// Calendar dates as 'YYYY-MM-DD' strings. All math goes through UTC so the
// visitor's timezone can never shift a night to the wrong weekday.

export type ISODate = string;

const DAY = 86400000;

export const isISODate = (s: unknown): s is ISODate =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const toUTC = (d: ISODate) => Date.parse(`${d}T00:00:00Z`);

export const fromUTC = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: ISODate, n: number): ISODate => fromUTC(toUTC(d) + n * DAY);

/** 0 = Sunday … 6 = Saturday */
export const weekday = (d: ISODate) => new Date(toUTC(d)).getUTCDay();

export const diffDays = (a: ISODate, b: ISODate) => Math.round((toUTC(b) - toUTC(a)) / DAY);

/** Today's date in Israel, regardless of the visitor's timezone */
export function todayInIsrael(now = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
}

const heFull = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const heShort = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

export const formatDateHe = (d: ISODate) => heFull.format(toUTC(d));
export const formatDateShort = (d: ISODate) => heShort.format(toUTC(d));
