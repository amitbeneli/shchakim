import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// R4 on desktop: the section pins and vertical scroll slides the cards right → left.
export function initR4Pin(section: HTMLElement, track: HTMLElement) {
  const mm = gsap.matchMedia();
  // Pinning only where it feels good: a real mouse/trackpad, wide screen, motion allowed
  mm.add('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    section.classList.add('is-pinned');
    // RTL: the track overflows to the LEFT, so we move it RIGHT (positive x)
    const distance = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, {
      x: distance,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
    return () => section.classList.remove('is-pinned');
  });
  document.addEventListener('astro:before-swap', () => mm.revert(), { once: true });
}
