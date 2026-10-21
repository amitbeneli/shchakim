import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initMedia } from './media';

gsap.registerPlugin(ScrollTrigger);

// "Why here" icons draw their own lines, scrubbed to scroll (scrolling back
// erases them). Paths use pathLength=1, so dashoffset 1 → 0 draws any path.
export function initHome() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = gsap.context(() => {
    document.querySelectorAll<HTMLElement>('[data-why]').forEach((item) => {
      const icon = item.querySelector<SVGElement>('.why__icon');
      if (!icon) return;
      const paths = icon.querySelectorAll('path');
      gsap.fromTo(
        paths,
        { strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          ease: 'none',
          stagger: 0.15,
          scrollTrigger: { trigger: icon, start: 'top 95%', end: 'top 62%', scrub: 0.5 },
        },
      );
    });
  });

  const media = initMedia();
  document.addEventListener('astro:before-swap', () => { ctx.revert(); media(); }, { once: true });
}
