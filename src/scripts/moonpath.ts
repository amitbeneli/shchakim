import { litPath } from '../lib/moon';

// Moon scroll companion.
// - Position: transform only, eased toward the scroll target with a lerp
//   (so it glides instead of jumping), rAF loop stops once it settles.
// - Phase: lit fraction grows from a thin crescent (top) to full (bottom).
// - Stops: one star per section heading, lit when the moon passes it.

const START_PHASE = 0.04;
const LERP = 0.14;

export function initMoonPath() {
  const root = document.querySelector<HTMLElement>('[data-moonpath]');
  // hidden below 1280px (MoonPath.astro) or under reduced motion: no scroll work at all
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches || getComputedStyle(root).display === 'none') return;

  const moon = root.querySelector<HTMLElement>('[data-moon]')!;
  const lit = root.querySelector<SVGPathElement>('[data-moon-lit]')!;
  const glow = root.querySelector<HTMLElement>('[data-moon-glow]')!;
  const stopsBox = root.querySelector<HTMLElement>('[data-moon-stops]')!;
  const hero = document.querySelector<HTMLElement>('[data-hero]');

  const ac = new AbortController();
  const { signal } = ac;

  let track = 0; // px the moon can travel
  let maxScroll = 1;
  let heroEnd = 0; // scroll offset where the moon "rises"
  let stops: { el: HTMLElement; at: number }[] = [];
  let target = 0;
  let current = 0;
  let raf = 0;
  let lastPhase = -1;

  const measure = () => {
    const moonSize = moon.offsetHeight;
    track = root.clientHeight - moonSize;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    heroEnd = hero ? Math.max(0, hero.offsetTop + hero.offsetHeight - innerHeight * 1.05) : 0;

    // A star for every section heading, placed where that heading reaches mid-screen
    stopsBox.replaceChildren();
    stops = [...document.querySelectorAll<HTMLElement>('main h2')].map((h) => {
      const y = h.getBoundingClientRect().top + scrollY - innerHeight * 0.5;
      const at = Math.min(1, Math.max(0, y / maxScroll));
      const el = document.createElement('i');
      el.style.top = `${(at * track + moonSize / 2).toFixed(1)}px`;
      stopsBox.append(el);
      return { el, at };
    });
    update();
  };

  const render = () => {
    current += (target - current) * LERP;
    if (Math.abs(target - current) < 0.0005) current = target;

    moon.style.transform = `translate3d(0, ${(current * track).toFixed(2)}px, 0)`;

    // Phase in 1% steps: avoids rebuilding the path on every tiny scroll
    const phase = Math.round((START_PHASE + (1 - START_PHASE) * current) * 100) / 100;
    if (phase !== lastPhase) {
      lit.setAttribute('d', litPath(phase, true, 10));
      glow.style.opacity = String(phase * 0.9);
      lastPhase = phase;
    }

    for (const s of stops) s.el.classList.toggle('is-lit', current >= s.at - 0.002);

    raf = current === target ? 0 : requestAnimationFrame(render);
  };

  const update = () => {
    target = Math.min(1, Math.max(0, scrollY / maxScroll));
    // On the home page the moon appears only once the hero sunset is over
    root.classList.toggle('is-visible', scrollY >= heroEnd);
    if (!raf) raf = requestAnimationFrame(render);
  };

  measure();
  current = target;
  render();

  addEventListener('scroll', update, { passive: true, signal });
  addEventListener('resize', measure, { passive: true, signal });
  // Images/fonts change the page height after load
  const ro = new ResizeObserver(() => measure());
  ro.observe(document.body);

  document.addEventListener(
    'astro:before-swap',
    () => {
      ac.abort();
      ro.disconnect();
      cancelAnimationFrame(raf);
    },
    { once: true },
  );
}
