// Runs heavy animation code (GSAP and the scroll scenes) only after the page has loaded and the
// browser is idle, so it never competes with the hero's first paint (LCP). The module is
// imported then, not at startup. If the user navigates away first, nothing runs.
export function afterLoad<M>(load: () => Promise<M>, run: (m: M) => void) {
  let left = false;
  document.addEventListener('astro:before-swap', () => (left = true), { once: true });
  const go = () => {
    const start = () => {
      if (!left) load().then((m) => !left && run(m));
    };
    // Safari has no requestIdleCallback: fall back to a short timeout
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1200 });
    else setTimeout(start, 200);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
