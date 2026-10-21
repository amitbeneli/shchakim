// Unsplash photos (free licence). Test site: chosen for beauty, credited in NOTES.md.
// Stage 6 swaps these for local AVIF/WebP via astro:assets.

export interface Photo {
  id: string;
  alt: string;
  /** Focal point for object-fit crops, e.g. '50% 80%' */
  focus?: string;
}

export const photos = {
  heroSky: { id: '1620029288530-4ff6a684e33d', alt: 'שביל החלב מעל צוק סלע במדבר' },
  lodgeNight: { id: '1706438229836-98f3720dbfc6', alt: 'שורת סוויטות מוארות בחושך המדבר' },
  archDoor: { id: '1775809679529-a8440bf14f52', alt: 'פתח מקושת שנפתח אל נוף המדבר' },
  domeNight: { id: '1762255107395-bcb83548e83f', alt: 'כיפת זכוכית מוארת תחת שמי לילה', focus: '60% 82%' },
  villaPool: { id: '1760261799672-2469a6c4c6f3', alt: 'וילה מאבן חול עם בריכה ועצי דקל' },
  villaCourt: { id: '1760261307890-62de1b42b666', alt: 'חצר פנימית עם בריכה ועצי דקל' },
  stargazers: { id: '1608408908478-fe36acb430ef', alt: 'שני אנשים על סלע מצביעים בפנס אל שביל החלב' },
  canyonCandles: { id: '1635623014754-277c8d855e81', alt: 'נרות דולקים על החול לרגלי צוקי אבן' },
  dinnerLanterns: { id: '1782642377662-83cecc77d8fb', alt: 'פינת אוכל בחוץ מוארת בפנסים בשעת דמדומים' },
  sunriseDunes: { id: '1764730358483-38395275edb5', alt: 'זריחה מעל מרחבי המדבר' },
  craterStars: { id: '1662960158221-f76b79584491', alt: 'עקבות כוכבים מעל צוק במכתש רמון' },
  craterDay: { id: '1669544881550-a84682c8d389', alt: 'מבט מהשפה אל עומק מכתש רמון' },
  duneMilkyWay: { id: '1568405336404-1fefdca58699', alt: 'שביל החלב מעל דיונות חול' },
} satisfies Record<string, Photo>;

const base = (id: string) => `https://images.unsplash.com/photo-${id}`;

export function src(p: Photo, w = 1200) {
  return `${base(p.id)}?w=${w}&q=70&auto=format&fit=crop`;
}

export function srcset(p: Photo, widths = [480, 800, 1200, 1800, 2400]) {
  return widths.map((w) => `${src(p, w)} ${w}w`).join(', ');
}
