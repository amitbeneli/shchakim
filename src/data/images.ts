// Every photo is a real photograph of Makhtesh Ramon / Mitzpe Ramon (Unsplash licence,
// credits in NOTES.md). They ship under one duotone grade (#ramon-grade in the layout),
// so photos from different photographers read as one archive of one place.
// Two night photos (starTrailsMesa, craterStars) have a camp at their base: they are only
// used as square plates cropped to sky and rock (focus), never in a gallery or lightbox.
// The suite interiors (gen-*) are generated images of our own fictional suites, never
// borrowed from other hotels; their section drawings live in SuiteDrawing.astro.

export interface Photo {
  id: string;
  alt: string;
  /** Where/when, shown as the field-plate caption */
  caption: string;
  /** Focal point for object-fit crops, e.g. '50% 80%' */
  focus?: string;
}

export const photos = {
  heroNight: { id: '1662960126803-02048050f381', alt: 'עקבות כוכבים מסתובבים מעל מצוק במכתש רמון', caption: 'מצוק המכתש, חשיפה של שעה' },
  starTrailsMesa: { id: '1662960126799-d621b5020d13', alt: 'עקבות כוכבים מעל גבעה בתוך המכתש', caption: 'בתוך המכתש, אחרי חצות', focus: '60% 8%' },
  craterStars: { id: '1662960158221-f76b79584491', alt: 'כוכבים מעל קיר סלע מואר במכתש רמון', caption: 'קיר השכבות, 23:40', focus: '30% 10%' },
  road: { id: '1662961345124-c8f747c38181', alt: 'הכביש יורד מהשפה אל קרקעית המכתש', caption: 'הירידה למכתש' },
  rimCouple: { id: '1664880847082-e7125cbc7ef0', alt: 'זוג יושב על שפת מכתש רמון ומביט אל עומקו', caption: 'שפת המכתש' },
  rimDeck: { id: '1662961047858-e570733ae899', alt: 'אדם עומד במרפסת תצפית מעל המכתש בשעת דמדומים', caption: 'מרפסת התצפית, דמדומים' },
  craterDay: { id: '1669544881550-a84682c8d389', alt: 'מבט מהשפה אל עומק מכתש רמון', caption: 'המכתש מהשפה הצפונית' },
  canyon: { id: '1652813738417-8a9437dfa98c', alt: 'ערוץ מתפתל בין קירות סלע בתוך המכתש', caption: 'ערוץ בתוך המכתש' },
  craterRed: { id: '1624946905412-8e325fb66e6d', alt: 'קרקעית המכתש באור הזריחה הראשון', caption: 'קרקעית המכתש, זריחה' },
  craterDusk: { id: '1624946903416-42a91871c222', alt: 'מכתש רמון לרוחבו בשעת השקיעה', caption: 'המכתש לרוחבו, שקיעה' },
  rimCliff: { id: '1579281703543-934686016e99', alt: 'צוקי השפה הדרומית של המכתש', caption: 'צוקי השפה' },
  // Suite interiors: generated (no real lodge exists), same blue hour and the same grade as the rest
  makhteshRoom: { id: 'gen-makhtesh-room', alt: 'מיטה זוגית מול קיר זכוכית אל המכתש בשעת דמדומים', caption: 'סוויטת מכתש, דמדומים' },
  makhteshDeck: { id: 'gen-makhtesh-deck', alt: 'מרפסת אבן עם מיטת יום על שפת המצוק', caption: 'המרפסת מעל המצוק' },
  kochavRoom: { id: 'gen-kochav-room', alt: 'חדר עם תקרת זכוכית ומיטה מתחת לשביל החלב', caption: 'סוויטת כוכב, תקרת הזכוכית' },
  kochavBath: { id: 'gen-kochav-bath', alt: 'אמבטיה עומדת מאבן מול חלון אל המכתש', caption: 'האמבטיה מול המכתש' },
  galaxiaRoof: { id: 'gen-galaxia-roof', alt: 'גג עם טלסקופ וג׳קוזי חם תחת שביל החלב', caption: 'וילת גלקסיה, הגג' },
  galaxiaLiving: { id: 'gen-galaxia-living', alt: 'סלון עם אח אבן וחלון רחב אל המכתש', caption: 'הסלון בווילה' },
  ibex: { id: '1604080566273-928a568303fc', alt: 'יעל על סלע בשפת המכתש', caption: 'יעל על השפה' },
} satisfies Record<string, Photo>;

// Self-hosted (public/photos, fetched once by design/tools/fetch-photos.mjs) so pages never
// depend on a third-party image CDN at load time.
const widths = [480, 800, 1200, 1800] as const;

export function src(p: Photo, w = 1200) {
  const fit = widths.find((x) => x >= w) ?? 1800;
  return `/photos/${p.id}-${fit}.webp`;
}

export function srcset(p: Photo) {
  return widths.map((w) => `${src(p, w)} ${w}w`).join(', ');
}
