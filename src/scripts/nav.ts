// R9 — header hide/show on scroll, full-screen mobile menu, floating book CTA.
// Called on every `astro:page-load`; everything registered here is torn down
// via one AbortController on `astro:before-swap`, so listeners never stack up.

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

let lockedScrollY = 0;

// iOS Safari ignores `overflow:hidden` on body for touch scrolling,
// so we pin the body with position:fixed and restore the offset afterwards.
function lockScroll() {
  lockedScrollY = window.scrollY;
  const s = document.body.style;
  s.position = 'fixed';
  s.top = `-${lockedScrollY}px`;
  s.insetInline = '0';
  s.width = '100%';
}
function unlockScroll() {
  const s = document.body.style;
  s.position = '';
  s.top = '';
  s.insetInline = '';
  s.width = '';
  window.scrollTo(0, lockedScrollY);
}

export function initHeader() {
  const ac = new AbortController();
  const { signal } = ac;
  const root = document.documentElement;

  /* ── Hide on scroll down, show on scroll up ── */
  let lastY = window.scrollY;
  let ticking = false;
  root.classList.remove('header-hidden');
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < 80 || delta < -4) root.classList.remove('header-hidden');
      else if (delta > 4 && !menuOpen) root.classList.add('header-hidden');
      lastY = y;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true, signal });
  // Keyboard users tabbing into the header must always see it
  document
    .querySelector('[data-header]')
    ?.addEventListener('focusin', () => root.classList.remove('header-hidden'), { signal });

  /* ── Mobile menu ── */
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  const closeBtn = document.querySelector<HTMLButtonElement>('[data-menu-close]');
  let menuOpen = false;

  const setOpen = (open: boolean, restoreFocus = true) => {
    if (!menu || !openBtn || open === menuOpen) return;
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      lockScroll();
      closeBtn?.focus();
    } else {
      unlockScroll();
      if (restoreFocus) openBtn.focus();
    }
  };

  openBtn?.addEventListener('click', () => setOpen(true), { signal });
  closeBtn?.addEventListener('click', () => setOpen(false), { signal });
  menu?.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => setOpen(false, false), { signal }),
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (!menuOpen || !menu) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      // Focus trap
      if (e.key === 'Tab') {
        const items = [...menu.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    { signal },
  );

  // Close if the viewport grows past the mobile breakpoint while open
  window
    .matchMedia('(min-width: 768px)')
    .addEventListener('change', (e) => e.matches && setOpen(false, false), { signal });

  /* ── Floating "book" CTA (mobile) — appears once the hero is out of view ── */
  const fab = document.querySelector<HTMLElement>('[data-fab]');
  if (fab) {
    const hero = document.querySelector('[data-hero]');
    const show = (v: boolean) => fab.classList.toggle('is-visible', v);
    if (hero) {
      const io = new IntersectionObserver(([entry]) => show(!entry.isIntersecting), {
        threshold: 0,
      });
      io.observe(hero);
      signal.addEventListener('abort', () => io.disconnect());
    } else {
      const check = () => show(window.scrollY > window.innerHeight * 0.6);
      check();
      window.addEventListener('scroll', check, { passive: true, signal });
    }
  }

  document.addEventListener(
    'astro:before-swap',
    () => {
      if (menuOpen) {
        menuOpen = false;
        unlockScroll();
      }
      ac.abort();
    },
    { once: true },
  );
}
