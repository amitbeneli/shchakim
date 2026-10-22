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

CI (`.github/workflows/ci.yml`) runs `astro check`, Vitest and the Playwright suite (Chromium + WebKit) on every push to `main` and on every pull request.

### Booking leads

Bookings are posted to a Google Apps Script web app (source: `docs/apps-script.gs`) that appends a row to a Google Sheet and sends a designed email to the owner and a confirmation to the guest. Set the URL as an environment variable:

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
| `public/photos/` | Self-hosted WebP photos with the colour grade baked in (`design/tools/bake-grade.mjs`) |
| `marketing/` | Two Instagram feed ads and their copy |
| `NOTES.md` / `SUBMISSION.md` | Decisions, trade-offs, photo credits, submission summary (Hebrew) |

Photos: Unsplash, plus AI-generated interiors of the fictional lodge (all credited in `NOTES.md`).
