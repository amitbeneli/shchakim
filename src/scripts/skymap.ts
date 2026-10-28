// R2 interactive sky map (Canvas 2D).
//
// Projection: a planisphere around the north celestial pole, seen through a
// window: the pole sits near the top edge and the sky is scaled to the frame
// height, so a band of the sky fills the view and rotating sweeps the rest in. A star's
// distance from the centre is proportional to (90° − declination) and its
// angle is its right ascension, so dragging = rotating the sky around the
// pole, exactly how the real sky turns overnight.
//
// Layers per frame: twinkling field stars (the faint ones only appear inside
// the desktop "flashlight"), constellation stars, the active constellation's
// lines (drawn progressively), and faint name labels for discoverability.
// The loop runs only while the map is on screen.

import { constellations, MAP_MIN_DEC, type Constellation } from '../data/constellations';

type Pt = { x: number; y: number };
interface FieldStar { ra: number; dec: number; b: number; r: number; tw: number; ph: number }

const DEG = Math.PI / 180;
const SPAN = 90 - MAP_MIN_DEC;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Galactic (l, b) → equatorial (ra hours, dec degrees), J2000 */
function galToEq(l: number, b: number) {
  const aG = 192.859 * DEG, dG = 27.128 * DEG, lN = 122.932 * DEG;
  const sinDec = Math.sin(b) * Math.sin(dG) + Math.cos(b) * Math.cos(dG) * Math.cos(lN - l);
  const dec = Math.asin(sinDec);
  const ra = aG + Math.atan2(Math.cos(b) * Math.sin(lN - l), Math.sin(b) * Math.cos(dG) - Math.cos(b) * Math.sin(dG) * Math.cos(lN - l));
  return { ra: (((ra / DEG / 15) % 24) + 24) % 24, dec: dec / DEG };
}

function buildField(): FieldStar[] {
  const rnd = mulberry32(2026);
  const out: FieldStar[] = [];
  const add = (ra: number, dec: number) => {
    if (dec < MAP_MIN_DEC) return;
    const b = Math.pow(rnd(), 2.6);
    out.push({ ra, dec, b, r: 0.4 + b * 1.3, tw: 0.6 + rnd() * 1.8, ph: rnd() * 6.28 });
  };
  // Even background (uniform over the map disc)
  for (let i = 0; i < 1000; i++) add(rnd() * 24, 90 - Math.sqrt(rnd()) * SPAN);
  // The Milky Way: stars crowd along the galactic plane
  for (let i = 0; i < 1300; i++) {
    const gauss = (rnd() + rnd() + rnd() - 1.5) * 9; // ≈ normal, σ ≈ 4.5°
    const { ra, dec } = galToEq(rnd() * 2 * Math.PI, gauss * DEG);
    add(ra, dec);
  }
  return out;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initSkyMap() {
  const root = document.querySelector<HTMLElement>('[data-r2]');
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const card = root.querySelector<HTMLElement>('[data-r2-card]')!;
  const cardName = card.querySelector<HTMLElement>('[data-r2-name]')!;
  const cardStory = card.querySelector<HTMLElement>('[data-r2-story]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-r2-pick]')];
  const ctx = canvas.getContext('2d')!;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const field = buildField();
  const ac = new AbortController();
  const { signal } = ac;

  let w = 0, h = 0, cx = 0, cy = 0, S = 0;
  // Initial view: the summer triangle region (Cygnus, Lyra) faces down into the window
  let rot = -(19.6 / 24) * 2 * Math.PI;
  let vel = 0;
  let active: Constellation | null = null;
  let drawT = 1; // line drawing progress 0..1
  let drawStart = 0;
  let cursor: Pt | null = null;
  let tween: { from: number; to: number; t0: number } | null = null;
  let running = false;
  let raf = 0;

  const project = (ra: number, dec: number): Pt => {
    const r = ((90 - dec) / SPAN) * S;
    const a = (ra / 24) * 2 * Math.PI + rot;
    return { x: cx - r * Math.sin(a), y: cy + r * Math.cos(a) };
  };
  const screenStars = (c: Constellation) => c.stars.map((s) => project(s.ra, s.dec));
  const centroid = (pts: Pt[]) => ({
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  });

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2;
    cy = h * 0.04; // the pole, just inside the top edge
    S = h * 1.02; // the southern rim (dec −48°) lands at the bottom edge
    if (!running) frame(performance.now());
  };

  /* ── Hit testing: distance to the nearest star or line of each constellation ── */
  const segDist = (p: Pt, a: Pt, b: Pt) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  // Generous: near a line, anywhere inside the constellation's area, or on its name
  const hit = (p: Pt): Constellation | null => {
    let best: Constellation | null = null;
    let bestD = fine ? 36 : 44; // bigger target for fingers
    for (const c of constellations) {
      const pts = screenStars(c);
      let d = Infinity;
      for (const [i, j] of c.lines) d = Math.min(d, segDist(p, pts[i], pts[j]));
      const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
      const pad = 18;
      if (p.x > Math.min(...xs) - pad && p.x < Math.max(...xs) + pad && p.y > Math.min(...ys) - pad && p.y < Math.max(...ys) + pad) d = Math.min(d, 24);
      const m = centroid(pts);
      if (Math.abs(p.x - m.x) < 48 && Math.abs(p.y - (m.y + 26)) < 14) d = 0; // the label
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  /* ── Selection + card ── */
  const select = (c: Constellation | null) => {
    if (c === active) return;
    active = c;
    drawStart = performance.now();
    drawT = reduce ? 1 : 0;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r2Pick === c?.id)));
    if (c) {
      cardName.textContent = c.name;
      cardStory.textContent = c.story;
      card.hidden = false;
    } else card.hidden = true;
    placeCard();
    wake();
  };

  const placeCard = () => {
    if (!active || card.hidden) return;
    if (!fine || w < 640) {
      card.style.left = card.style.top = '';
      card.classList.add('is-docked'); // phones: docked to the bottom of the map
      return;
    }
    card.classList.remove('is-docked');
    const c = centroid(screenStars(active));
    const cw = card.offsetWidth, ch = card.offsetHeight;
    // Beside the constellation, on the side with more room, clamped into the frame
    let x = c.x < w / 2 ? c.x + 110 : c.x - cw - 110;
    let y = c.y - ch / 2;
    x = Math.max(12, Math.min(w - cw - 12, x));
    y = Math.max(12, Math.min(h - ch - 12, y));
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  };

  /* ── Rotate a picked constellation up into view (used by the keyboard list) ── */
  const bringUp = (c: Constellation) => {
    const ra = c.stars.reduce((a, s) => a + s.ra, 0) / c.stars.length;
    // Want angle a = 0 (straight down from the pole, centre of the window)
    let to = -(ra / 24) * 2 * Math.PI;
    while (to - rot > Math.PI) to -= 2 * Math.PI;
    while (to - rot < -Math.PI) to += 2 * Math.PI;
    if (reduce) {
      rot = to;
      return;
    }
    tween = { from: rot, to, t0: performance.now() };
    vel = 0;
  };

  /* ── Render ── */
  const frame = (t: number) => {
    if (tween) {
      const k = Math.min(1, (t - tween.t0) / 900);
      rot = tween.from + (tween.to - tween.from) * ease(k);
      if (k === 1) tween = null;
    } else if (Math.abs(vel) > 0.00005) {
      rot += vel;
      vel *= 0.94; // inertia after a flick
    }
    if (active && drawT < 1) drawT = Math.min(1, (t - drawStart) / 700);

    ctx.clearRect(0, 0, w, h);

    // Field stars
    const R = 120; // flashlight radius
    for (const s of field) {
      const p = project(s.ra, s.dec);
      if (p.x < -2 || p.y < -2 || p.x > w + 2 || p.y > h + 2) continue;
      let a = 0.3 + s.b * 0.7;
      if (!reduce) a *= 0.72 + 0.28 * Math.sin((t / 1000) * s.tw + s.ph);
      if (s.b < 0.12) {
        // Faint stars: hidden until the flashlight passes (desktop); dim on touch
        if (fine && cursor) {
          const d = Math.hypot(p.x - cursor.x, p.y - cursor.y);
          a *= d < R ? Math.pow(1 - d / R, 0.8) * 1.6 : 0;
        } else a *= fine ? 0 : 0.45;
      }
      if (a <= 0.01) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = '#f4f1e8';
      const r = s.r;
      if (r < 0.9) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Flashlight halo
    if (fine && cursor) {
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, R);
      g.addColorStop(0, 'rgba(244,241,232,0.07)');
      g.addColorStop(1, 'rgba(244,241,232,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Constellations
    ctx.font = '600 15px Assistant, sans-serif';
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    for (const c of constellations) {
      const pts = screenStars(c);
      const isOn = c === active;

      if (!isOn) {
        // every figure faintly drawn, so the eye knows where to point
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#d9a86c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [i, j] of c.lines) {
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
        }
        ctx.stroke();
      }
      if (isOn) {
        // Lines draw in order, segment by segment
        const total = c.lines.length;
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#d9a86c';
        ctx.lineWidth = 1.4;
        ctx.shadowColor = 'rgba(217,168,108,0.6)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        c.lines.forEach(([i, j], n) => {
          const k = Math.max(0, Math.min(1, drawT * total - n));
          if (k <= 0) return;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i].x + (pts[j].x - pts[i].x) * k, pts[i].y + (pts[j].y - pts[i].y) * k);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      c.stars.forEach((s, i) => {
        const p = pts[i];
        const r = Math.max(1.1, 3 - s.m * 0.55) * (isOn ? 1.25 : 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = isOn ? '#fff6e6' : '#f4f1e8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (s.m < 1.2) {
          // Brightest stars get a soft glow
          ctx.globalAlpha = isOn ? 0.35 : 0.18;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Labels so visitors know where to point: readable over the Milky Way (dark halo)
      if (!isOn) {
        const m = centroid(pts);
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(11,14,26,0.85)';
        ctx.strokeText(c.name, m.x, m.y + 26);
        ctx.fillStyle = '#e2bd8c';
        ctx.fillText(c.name, m.x, m.y + 26);
      }
    }
    ctx.globalAlpha = 1;
    if (active && (tween || Math.abs(vel) > 0.00005)) placeCard();

    const animating = !reduce || tween || Math.abs(vel) > 0.00005 || drawT < 1;
    raf = running && animating ? requestAnimationFrame(frame) : 0;
  };

  const wake = () => {
    if (running && !raf) raf = requestAnimationFrame(frame);
    else if (!running) frame(performance.now());
  };

  /* ── Pointer: drag rotates (with inertia), tap/hover selects ── */
  let drag: { x: number; lastX: number; moved: boolean; id: number } | null = null;
  const local = (e: PointerEvent): Pt => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      canvas.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, lastX: e.clientX, moved: false, id: e.pointerId };
      tween = null;
      vel = 0;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      const p = local(e);
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.lastX;
        if (Math.abs(e.clientX - drag.x) > 6) drag.moved = true;
        if (drag.moved) {
          // RTL-natural: dragging left turns the sky the way the finger goes
          rot += dx * 0.006;
          vel = reduce ? 0 : dx * 0.006;
          root.classList.add('is-dragging');
          placeCard();
        }
        drag.lastX = e.clientX;
      } else if (fine) {
        const c = hit(p);
        if (c) select(c);
        root.classList.toggle('is-over', !!c);
      }
      if (fine) cursor = p;
      wake();
    },
    { signal },
  );
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved) select(hit(local(e))); // a tap: select what's under the finger, or clear
    drag = null;
    root.classList.remove('is-dragging');
    wake();
  };
  canvas.addEventListener('pointerup', up, { signal });
  canvas.addEventListener('pointercancel', up, { signal });
  canvas.addEventListener(
    'pointerleave',
    () => {
      cursor = null;
      wake();
    },
    { signal },
  );

  /* ── Accessible list: the same constellations as real buttons ── */
  buttons.forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        const c = constellations.find((x) => x.id === b.dataset.r2Pick)!;
        if (active === c) return select(null);
        bringUp(c);
        select(c);
        wake();
      },
      { signal },
    ),
  );
  root.addEventListener('keydown', (e) => e.key === 'Escape' && select(null), { signal });

  /* ── Only animate while visible ── */
  const io = new IntersectionObserver(([e]) => {
    running = e.isIntersecting;
    if (running) wake();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => {
    resize();
    placeCard();
  });
  ro.observe(canvas);

  document.addEventListener(
    'astro:before-swap',
    () => {
      ac.abort();
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    },
    { once: true },
  );
}
