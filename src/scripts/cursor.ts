// R5: cursor accent + magnetic buttons.
// Only for a real mouse/trackpad: (hover: hover) and (pointer: fine), and only
// when motion is allowed. On touch devices nothing is created — not in the DOM.
//
// The system cursor is never hidden or replaced: it stays visible from the first moment on
// every page (hiding it until the first mouse move made it "disappear" on arrival).
// - Over anything clickable a soft sand ring appears around the pointer and follows it.
// - Over an element with data-cursor-label the ring opens into a disc with a word in it
//   ("גרירה" on the R7 slider, "הגדלה" on gallery photos). The ring never takes pointer
//   events, so it can't get in the way of a drag or a click.
// - Buttons (.btn) lean toward the pointer, then spring back on leave.

const INTERACTIVE = 'a, button, [role="slider"], summary, label, [data-cursor]';
const HIDE = 'input, textarea, select, [data-r2] canvas, dialog[open]';

export function initCursor() {
  const can = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!can) return;

  // ClientRouter replaces <body> on navigation, so (re)create per page
  const ring = document.createElement('div');
  ring.className = 'cur-ring';
  ring.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'cur-label';
  ring.append(label);
  document.body.append(ring);

  const ac = new AbortController();
  const { signal } = ac;
  let x = -100, y = -100, rx = -100, ry = -100;
  let raf = 0;
  let shown = false;

  const loop = () => {
    rx += (x - rx) * 0.35;
    ry += (y - ry) * 0.35;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      const t = e.target as Element;
      const word = t.closest?.('[data-cursor-label]')?.getAttribute('data-cursor-label') ?? '';
      const on = !t.closest?.(HIDE) && (!!word || !!t.closest?.(INTERACTIVE));
      // appearing: start at the pointer, not sliding in from where it was last seen
      if (on && !shown) {
        rx = x;
        ry = y;
      }
      shown = on;
      ring.classList.toggle('is-on', on);
      if (label.textContent !== word) label.textContent = word;
      ring.classList.toggle('has-label', !!word);
      if (!raf) raf = requestAnimationFrame(loop);
    },
    { passive: true, signal },
  );
  document.addEventListener('pointerleave', () => {
    shown = false;
    ring.classList.remove('is-on');
  }, { signal });
  addEventListener('pointerdown', () => ring.classList.add('is-down'), { signal });
  addEventListener('pointerup', () => ring.classList.remove('is-down'), { signal });

  /* ── Magnetic buttons ── */
  document.querySelectorAll<HTMLElement>('.btn').forEach((btn) => {
    btn.addEventListener(
      'pointermove',
      (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.transition = 'transform 0.15s ease-out';
        btn.style.transform = `translate(${dx * 0.22}px, ${dy * 0.3}px)`;
      },
      { signal },
    );
    btn.addEventListener(
      'pointerleave',
      () => {
        btn.style.transition = 'transform 0.6s cubic-bezier(0.22, 1.4, 0.36, 1)'; // springy return
        btn.style.transform = '';
      },
      { signal },
    );
  });

  document.addEventListener(
    'astro:before-swap',
    () => {
      ac.abort();
      cancelAnimationFrame(raf);
    },
    { once: true },
  );
}
