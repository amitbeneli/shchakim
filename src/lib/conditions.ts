// R6: "tonight's observing conditions" (CLAUDE.md appendix C). Pure logic, tested.
import { addDays, type ISODate } from './dates';

export interface OpenMeteoHourly {
  hourly: { time: string[]; cloud_cover: (number | null)[] };
}

/** "Tonight" = 21:00 of `date` through 03:00 of the next day (Israel local time) */
export function tonightHours(date: ISODate): string[] {
  const next = addDays(date, 1);
  return [
    ...['21', '22', '23'].map((h) => `${date}T${h}:00`),
    ...['00', '01', '02', '03'].map((h) => `${next}T${h}:00`),
  ];
}

/** Average cloud cover over tonight's hours, or null if the data doesn't cover them */
export function averageCloud(data: OpenMeteoHourly, date: ISODate): number | null {
  const idx = new Map(data.hourly.time.map((t, i) => [t, i]));
  const values = tonightHours(date)
    .map((t) => idx.get(t))
    .map((i) => (i === undefined ? null : data.hourly.cloud_cover[i]))
    .filter((v): v is number => typeof v === 'number');
  if (values.length < 4) return null; // too little data to say anything honest
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type Rating = 'excellent' | 'good' | 'weak';

/** cloud and moon are 0–100 */
export function rate(cloud: number, moon: number): Rating {
  if (cloud < 20 && moon < 40) return 'excellent';
  if (cloud < 50 && moon < 75) return 'good';
  return 'weak';
}

export const RATING_LABEL: Record<Rating, string> = { excellent: 'מצוין', good: 'טוב', weak: 'חלש' };

export const RATING_TEXT: Record<Rating, string> = {
  excellent: 'שמיים כמעט נקיים וירח חלש. לילה שבשבילו באים לכאן.',
  good: 'יהיה מה לראות. כדאי לתפוס את השעות שבהן העננים נפתחים.',
  weak: 'עננים או ירח בהיר יסתירו הלילה חלק מהכוכבים. הלילות הבאים עשויים להיות טובים יותר.',
};

export const RULE_TEXT = 'מצוין: עננות מתחת ל־20% ותאורת ירח מתחת ל־40%. טוב: עננות מתחת ל־50% ותאורת ירח מתחת ל־75%. כל השאר: חלש.';

export const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=30.61&longitude=34.80&hourly=cloud_cover&timezone=Asia%2FJerusalem&forecast_days=2';
