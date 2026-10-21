# שחקים · SHCHAKIM

A Hebrew, RTL, mobile-first marketing and booking site for a (fictional) stargazing lodge on the rim of Makhtesh Ramon. Built as a home assignment for AdVision Group.

**Stack:** Astro 7 (static) · View Transitions (`ClientRouter`) · GSAP + ScrollTrigger · Canvas 2D · Preact island for the booking wizard · plain CSS with logical properties · Vitest · Playwright

## Run it

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output in dist/
npm test             # Vitest: pricing, moon phases, validation, conditions
npm run test:e2e     # Playwright: all pages in Chromium, WebKit (iPhone) and desktop
```

### Booking leads

Bookings are posted to a Google Apps Script web app that appends a row to a Google Sheet (see `CLAUDE.md`, appendix A). Set the URL as an environment variable:

```
PUBLIC_LEAD_ENDPOINT=https://script.google.com/macros/s/…/exec
```

Without it, `npm run dev` simulates a successful send so the flow can be tested, and a production build shows a clear error state.

## Where things live

| Path | What |
|---|---|
| `src/components/R*.astro` | One component per required feature (R1 hero … R10 FAQ) |
| `src/components/booking/` | The 5-step booking wizard (Preact) and range calendar |
| `src/lib/pricing.ts` | Pure price engine in integer agorot (weekend surcharge, min/max nights, STARS10, VAT) |
| `src/lib/moon.ts` | Moon age, illumination and phase SVG path |
| `src/lib/conditions.ts` | Tonight's observing conditions from Open-Meteo |
| `src/data/` | Suites, add-ons, FAQ, reviews, constellations, mock availability |
| `src/scripts/` | Client scripts (nav, moon path, sky map, cursor, reveals) |
| `tests/` | Vitest unit tests and Playwright e2e smoke tests |
| `NOTES.md` / `SUBMISSION.md` | Decisions, trade-offs, photo credits, submission summary (Hebrew) |

Photos: Unsplash (credits in `NOTES.md`).
