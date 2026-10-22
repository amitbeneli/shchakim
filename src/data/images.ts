// Every photo is a real photograph of Makhtesh Ramon / Mitzpe Ramon (Unsplash licence,
// credits in NOTES.md). They ship under one duotone grade, baked into the files,
// so photos from different photographers read as one archive of one place.
// Two night photos (starTrailsMesa, craterStars) have a camp at their base: they are only
// used as square plates cropped to sky and rock (focus), never in a gallery or lightbox.
// The suite interiors and the lodge (gen-*) are generated images of our own fictional
// place, never borrowed from other hotels.

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
  lodgeExterior: { id: 'gen-lodge-exterior', alt: 'שורת הסוויטות של שחקים על שפת המצוק, חלונות מוארים ושביל החלב מעל', caption: 'שחקים על שפת המצוק, שעה כחולה' },
  coupleNight: { id: 'gen-couple-night', alt: 'זוג עטוף בשמיכה על מעקה המרפסת, מתחת לקשת שביל החלב מעל המכתש', caption: 'מרפסת סוויטה, אחרי חצות' },
  galaxiaLiving: { id: 'gen-galaxia-living', alt: 'סלון עם ספה שקועה, אח טיח וחלונות רחבים אל המכתש', caption: 'הסלון בווילה' },
  // R7: the city side of the comparison (a real Tel Aviv night, Unsplash)
  // R7: one night frame over the crater, and its twin baked in code with a city's skyglow
  // (tools/r7-city-sky.py: the same stars; the faint ones and the Milky Way lost in the glow)
  r7Ramon: { id: 'gen-r7-ramon', alt: 'שביל החלב עולה מעל קרקעית מכתש רמון ומאות כוכבים', caption: 'מעל המכתש' },
  r7City: { id: 'gen-r7-city', alt: 'אותו נוף ואותם שמיים תחת זוהר כתום של עיר, רק כוכבים בודדים נראים', caption: 'אותם שמיים עם אור של עיר' },
  // The experiences, each showing the activity itself
  xpDinner: { id: 'gen-xp-dinner', alt: 'שולחן נמוך ערוך על מרפסת אבן מעל המכתש, כריות ישיבה, פנסים, נרות ומדורה בשעה כחולה', caption: 'ארוחת ערב במדבר', focus: '50% 62%' },
  xpAstronomer: { id: 'gen-xp-astronomer', alt: 'מדריך מצביע בלייזר ירוק על כוכב, לידו טלסקופ גדול וזוג שמביט לשמיים', caption: 'תצפית מודרכת', focus: '60% 55%' },
  xpPhoto: { id: 'gen-xp-photo', alt: 'מצלמה על חצובה מול שביל החלב, וצלם כורע לידה עם פנס ראש אדום', caption: 'סדנת צילום כוכבים', focus: '62% 55%' },
  xpJeep: { id: 'gen-xp-jeep', alt: 'זוג עטוף בשמיכות ליד ג׳יפ פתוח על שפת המכתש, רגע לפני הזריחה', caption: 'ג׳יפ לזריחה', focus: '55% 60%' },
  ibex: { id: '1604080566273-928a568303fc', alt: 'יעל על סלע בשפת המכתש', caption: 'יעל על השפה' },
} satisfies Record<string, Photo>;

// Self-hosted (public/photos, fetched once by design/tools/fetch-photos.mjs) so pages never
// depend on a third-party image CDN at load time.
const widths = [480, 800, 1200, 1800] as const;

/** The grade is baked into the files (design/tools/bake-grade.mjs); raw = the ungraded copy,
 *  kept only for the hero's rock layers, which carry their own tint. */
export function src(p: Photo, w = 1200, raw = false) {
  const fit = widths.find((x) => x >= w) ?? 1800;
  // gen-* files were regenerated under the same names: the query busts browser and CDN caches
  const v = p.id.startsWith('gen-') ? '?v=3' : '';
  return `/photos/${p.id}-${fit}${raw ? '-raw' : ''}.webp${v}`;
}

export function srcset(p: Photo) {
  return widths.map((w) => `${src(p, w)} ${w}w`).join(', ');
}
