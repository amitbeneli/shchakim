import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Photographs that live with the scroll: each [data-media] frame opens from a slight
// inset as it arrives, and the photo inside drifts and settles from a gentle zoom while
// the frame crosses the screen. Transform + clip-path only. Returns a cleanup.
export function initMedia(root: ParentNode = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = gsap.context(() => {});
  // Set up after the page settles, so it never competes with the first paint
  const start = () =>
    ctx.add(() => {
      root.querySelectorAll<HTMLElement>('[data-media]').forEach((frame) => {
        const img = frame.querySelector('img');
        if (!img) return;
        // one trigger per frame: the inset opens over the first ~40% of the pass,
        // the photo drifts and settles across the whole pass
        gsap
          .timeline({ scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
          .fromTo(frame, { clipPath: 'inset(7% 5% 7% 5%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 0.4 }, 0)
          .fromTo(img, { scale: 1.16, yPercent: -4 }, { scale: 1.02, yPercent: 4, ease: 'none', duration: 1 }, 0);
      });
    });
  // Safari has no requestIdleCallback: fall back to a short timeout
  const idle = 'requestIdleCallback' in window;
  const id = idle ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 300);
  return () => {
    if (idle) window.cancelIdleCallback(id);
    else clearTimeout(id);
    ctx.revert();
  };
}
