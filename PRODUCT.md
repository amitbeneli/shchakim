# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Couples aged 28–50 from central Israel with high income, looking for a "different" weekend, a birthday or a marriage proposal. Most arrive on a phone from an Instagram ad, so mobile is the primary site, not the secondary one. The site is also judged on desktop by the AdVision Group reviewers (this is a hiring home assignment).

## Product Purpose
Marketing and booking site for שחקים (SHCHAKIM), a fictional boutique stargazing lodge on the rim of Makhtesh Ramon, Mitzpe Ramon. Success = the visitor feels the desert night and books a night (or leaves details). Every design decision serves booking.

## Positioning
Nine suites built entirely around the sky (open balconies, glass ceilings, private telescopes) on the rim of a real crater with dark skies; the lodge sells nights of observation, not rooms with a view.

## Operating Context
Visitor scrolls on a phone at night or in a break, from Instagram; reviewers check every required component (R1–R10), mobile at 375px, iPhone Safari, desktop 1440/1920, Lighthouse ≥80 perf / ≥95 a11y, zero console errors.

## Capabilities and Constraints
- Stack: Astro 7 static, ClientRouter view transitions, GSAP + ScrollTrigger, Canvas 2D, Preact booking island, plain CSS with logical properties, Vercel. Keep all existing function (R1–R10, booking wizard, pricing engine, tests).
- Full RTL Hebrew; no English UI text left; no exclamation marks; no superlatives.
- prefers-reduced-motion must give a quiet, complete site.
- Booking: 3 suites (מכתש 1,450 ₪ up to 2; כוכב 1,890 ₪ up to 2; גלקסיה 2,690 ₪ up to 4), 4 add-ons, Thu/Fri +20%, min 2 nights when Thu/Fri included, max 7, STARS10 on lodging, VAT 18% included.

## Brand Commitments
- Palette fixed by the brief (may add in-between shades, may not change direction): night #0B0E1A, dusk #2A1E3F, crater sand #D9A86C, ember #E2683C, starlight #F4F1E8.
- Fonts fixed by the brief: headings Frank Ruhl Libre; running text Assistant.
- Wordmark: "שחקים" + "SHCHAKIM", simple and typographic.
- Voice: quiet, luxurious, slightly poetic, never condescending; "a desert guide speaking softly by a campfire".
- Reviewer feedback on the beta (must be fixed): the photos do not read as one real place; the typography is inconsistent and does not follow what the brief asked for.

## Evidence on Hand
Business facts only: 9 suites in 3 types; 300+ clear nights a year; 4,200 guests since opening in 2022; rating 4.9 from 380 reviews; address דרך בראשית, מצפה רמון; phone 08-0000000 (dummy). No awards, certifications or partnerships may be invented. Reviews on the site are written by us in a believable tone. Imagery: free stock (Unsplash/Pexels) or AI-generated, but it must look like one real, consistent place (same hour, same grade, same architecture).

## Product Principles
1. Mobile first: 80% of components smooth on iPhone beats 100% that break.
2. The night sky is the product; everything else frames it.
3. Every section leads toward booking a night.
4. Truthful: only the brief's business facts; fiction is labeled as ours.

## Accessibility & Inclusion
Israeli standard 5568 (WCAG 2.0 AA): full keyboard, visible focus in sand, alt text, AA contrast, reduced motion, accessibility statement page.
