// Site-wide, dependency-free scroll effects:
//   [data-reveal]      fades/rises in once it enters the viewport (CSS does the motion)
//   [data-count]       counts up from 0 to its value when it enters the viewport
// Under reduced motion nothing is hidden and numbers are shown as-is.

const fmt = (n: number, decimals: number) =>
  new Intl.NumberFormat('he-IL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  const decimals = Number(el.dataset.decimals ?? 0);
  const dur = 1600;
  const t0 = performance.now();
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 4); // ease-out: fast start, gentle landing
    el.textContent = fmt(to * eased, decimals);
    if (k < 1) requestAnimationFrame(tick);
  };
  el.textContent = fmt(0, decimals);
  requestAnimationFrame(tick);
}

export function initReveal() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        if (el.dataset.count !== undefined) countUp(el);
        else el.classList.add('is-in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );

  document.querySelectorAll<HTMLElement>('[data-reveal], [data-count]').forEach((el) => io.observe(el));
  document.addEventListener('astro:before-swap', () => io.disconnect(), { once: true });
}
