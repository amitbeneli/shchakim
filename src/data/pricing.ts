// Single source of truth for suites, add-ons and pricing config (CLAUDE.md §5).
import { photos, type Photo } from './images';

// Prices are whole shekels incl. VAT; src/lib/pricing.ts converts to agorot for math.

export type SuiteSlug = 'makhtesh' | 'kochav' | 'galaxia';

export interface Suite {
  slug: SuiteSlug;
  name: string;
  maxGuests: number;
  nightly: number;
  highlight: string;
  summary: string;
  description: string[];
  amenities: string[];
  units: number;
  photo: Photo;
  gallery: Photo[];
}

export const suites: Suite[] = [
  {
    slug: 'makhtesh',
    name: 'סוויטת מכתש',
    maxGuests: 2,
    nightly: 1450,
    highlight: 'מרפסת פרטית מול המכתש',
    summary: 'מרפסת פרטית על שפת המצוק וקיר זכוכית שנפתח אל המכתש.',
    description: [
      'הסוויטה נבנתה סביב המרפסת. קיר זכוכית נפתח עד הסוף, ומעבר לו רק המכתש, עמוק ושקט.',
      'בערב נדלקת תאורה אדומה עמומה שלא מסנוורת את העין, כדי שתוכלו לצאת החוצה בלי לאבד את הכוכבים.',
    ],
    amenities: [
      'מרפסת פרטית עם מיטת יום',
      'מיטה זוגית רחבה',
      'מקלחת גשם',
      'תאורת לילה אדומה',
      'מפת שמיים עונתית',
      'פינת קפה ותה',
    ],
    units: 4,
    photo: photos.makhteshRoom,
    gallery: [photos.makhteshRoom, photos.makhteshDeck, photos.craterDusk, photos.rimDeck],
  },
  {
    slug: 'kochav',
    name: 'סוויטת כוכב',
    maxGuests: 2,
    nightly: 1890,
    highlight: 'תקרת זכוכית מעל המיטה',
    summary: 'תקרת זכוכית שלמה מעל המיטה. נרדמים מול שביל החלב.',
    description: [
      'מעל המיטה פתוחה תקרת זכוכית. כשמכבים את האור, החדר נעלם והשמיים נשארים.',
      'וילון חשמלי סוגר את התקרה בבוקר, כך שהשמש לא מעירה לפני שאתם רוצים.',
    ],
    amenities: [
      'תקרת זכוכית מעל המיטה',
      'וילון האפלה חשמלי',
      'מרפסת קטנה לכיוון מזרח',
      'אמבטיה עומדת',
      'משקפת לתצפית',
      'פינת קפה ותה',
    ],
    units: 3,
    photo: photos.kochavRoom,
    gallery: [photos.kochavRoom, photos.kochavBath, photos.heroNight, photos.craterRed],
  },
  {
    slug: 'galaxia',
    name: 'וילת גלקסיה',
    maxGuests: 4,
    nightly: 2690,
    highlight: 'טלסקופ פרטי וג׳קוזי על הגג',
    summary: 'וילה לארבעה עם שני חדרי שינה, וגג פרטי עם ג׳קוזי חם וטלסקופ.',
    description: [
      'שני חדרי שינה, סלון עם חלון רחב, ומדרגות שעולות לגג. שם מחכים ג׳קוזי חם וטלסקופ פרטי.',
      'בערב הראשון אחד המדריכים עולה אליכם ומכוון את הטלסקופ לגרם השמיים הבהיר ביותר באותו לילה.',
    ],
    amenities: [
      'גג פרטי עם ג׳קוזי חם',
      'טלסקופ פרטי',
      'שני חדרי שינה',
      'סלון ומטבחון',
      'כיוון טלסקופ ראשון עם מדריך',
      'מרפסת מול המכתש',
    ],
    units: 2,
    photo: photos.galaxiaRoof,
    gallery: [photos.galaxiaRoof, photos.galaxiaLiving, photos.rimCliff, photos.canyon],
  },
];

export type AddonPricing = 'perPerson' | 'perBooking';

export interface Addon {
  id: 'astronomer' | 'photo' | 'dinner' | 'jeep';
  name: string;
  price: number;
  pricing: AddonPricing;
  duration: string;
  summary: string;
  photo: Photo;
}

export const addons: Addon[] = [
  {
    id: 'astronomer',
    name: 'תצפית מודרכת עם אסטרונום',
    price: 180,
    pricing: 'perPerson',
    duration: 'כשעתיים',
    summary: 'טלסקופים גדולים, לייזר שמצביע על הכוכבים, והסיפורים שמאחוריהם.',
    photo: photos.craterStars,
  },
  {
    id: 'photo',
    name: 'סדנת צילום כוכבים',
    price: 450,
    pricing: 'perBooking',
    duration: 'כשלוש שעות',
    summary: 'חצובה, חשיפה ארוכה ושביל החלב. יוצאים עם תמונה אחת שתרצו לתלות.',
    photo: photos.starTrailsMesa,
  },
  {
    id: 'dinner',
    name: 'ארוחת ערב במדבר',
    price: 290,
    pricing: 'perPerson',
    duration: 'כשעתיים וחצי',
    summary: 'שולחן נמוך על החול, אש פתוחה ותפריט עונתי מחומרי גלם של הנגב.',
    photo: photos.craterDusk,
  },
  {
    id: 'jeep',
    name: 'ג׳יפ לזריחה',
    price: 220,
    pricing: 'perPerson',
    duration: 'כשלוש שעות',
    summary: 'יוצאים בחושך, כשעה לפני הזריחה (השעה משתנה לפי העונה), ורואים את המכתש מתמלא אור.',
    photo: photos.road,
  },
];

export const pricingConfig = {
  /** Night-of weekdays (0=Sun … 6=Sat) that carry a surcharge. Saturday night: no surcharge (clarified). */
  surchargeWeekdays: [4, 5] as number[],
  surchargeRate: 0.2,
  /** A stay that includes any of these nights requires minWeekendNights. */
  weekendNights: [4, 5] as number[],
  minWeekendNights: 2,
  maxNights: 7,
  // STARS10 is the brief's coupon. TEST100 is a 100% code for trying the flow end to end.
  coupons: [
    { code: 'STARS10', rate: 0.1 },
    { code: 'TEST100', rate: 1 },
  ],
  vatRate: 0.18,
};

export const getSuite = (slug: string) => suites.find((s) => s.slug === slug);
