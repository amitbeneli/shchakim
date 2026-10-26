// R5: custom cursor + magnetic buttons.
// Only for a real mouse/trackpad: (hover: hover) and (pointer: fine), and only
// when motion is allowed. On touch devices nothing is created — not in the DOM.
//
// - A small dot tracks the pointer exactly; a ring follows with a lerp (lag).
// - Over anything clickable the ring grows and fills; over text fields it hides
//   (the native I-beam is clearer); over the sky map the map's flashlight takes over.
// - Over an element with data-cursor-label the ring opens into a pill with a word in it
//   ("גרירה" on the R7 slider, "הגדלה" on gallery photos). The ring never takes pointer
//   events, so it can't get in the way of a drag or a click.
// - Buttons (.btn) lean toward the pointer, then spring back on leave.

const INTERACTIVE = 'a, button, [role="slider"], summary, label, [data-cursor]';
const HIDE = 'input, textarea, select, [data-r2] canvas, dialog[open]';

export function initCursor() {
  const can = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!can) return;

  // ClientRouter replaces <body> on navigation, so (re)create per page
  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cur-dot';
  ring.className = 'cur-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'cur-label';
  ring.append(label);
  document.body.append(ring, dot);
  document.documentElement.classList.add('has-cursor');

  const ac = new AbortController();
  const { signal } = ac;
  let x = -100, y = -100, rx = -100, ry = -100;
  let raf = 0;
  let visible = false;

  const loop = () => {
    rx += (x - rx) * 0.3;
    ry += (y - ry) * 0.3;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        rx = x;
        ry = y;
        document.documentElement.classList.add('cur-on');
      }
      const t = e.target as Element;
      ring.classList.toggle('is-hover', !!t.closest?.(INTERACTIVE));
      const word = t.closest?.('[data-cursor-label]')?.getAttribute('data-cursor-label') ?? '';
      if (label.textContent !== word) label.textContent = word;
      ring.classList.toggle('has-label', !!word);
      dot.classList.toggle('is-off', !!word); // the word sits where the dot would
      document.documentElement.classList.toggle('cur-hidden', !!t.closest?.(HIDE));
      if (!raf) raf = requestAnimationFrame(loop);
    },
    { passive: true, signal },
  );
  document.addEventListener('pointerleave', () => document.documentElement.classList.remove('cur-on'), { signal });
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
      document.documentElement.classList.remove('has-cursor', 'cur-on', 'cur-hidden');
    },
    { once: true },
  );
}
