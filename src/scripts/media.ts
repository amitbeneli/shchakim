import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Photographs that live with the scroll: each [data-media] frame opens from a slight
// inset as it arrives, and the photo inside drifts and settles from a gentle zoom while
// the frame crosses the screen. Transform + clip-path only. Returns a cleanup.
export function initMedia(root: ParentNode = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = gsap.context(() => {
    root.querySelectorAll<HTMLElement>('[data-media]').forEach((frame) => {
      const img = frame.querySelector('img');
      if (!img) return;
      gsap.fromTo(
        frame,
        { clipPath: 'inset(7% 5% 7% 5%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'top 45%', scrub: 0.6 } },
      );
      gsap.fromTo(
        img,
        { scale: 1.16, yPercent: -4 },
        { scale: 1.02, yPercent: 4, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.6 } },
      );
    });
  });
  return () => ctx.revert();
}
