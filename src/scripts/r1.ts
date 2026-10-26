import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ───────── Twinkling star field (Canvas 2D) ─────────
   DPR-aware, and the rAF loop only runs while the hero is on screen. */
function starField(canvas: HTMLCanvasElement, animate: boolean) {
  const ctx = canvas.getContext('2d')!;
  let stars: { x: number; y: number; r: number; base: number; speed: number; phase: number }[] = [];
  let raf = 0;
  let running = false;

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Density scales with area; stars stay in the sky, above the ridges
    const count = Math.round((w * h) / 7000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.66,
      r: Math.random() < 0.08 ? 1.4 + Math.random() * 0.8 : 0.4 + Math.random() * 0.8,
      base: 0.35 + Math.random() * 0.6,
      speed: 0.6 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
    }));
    draw(performance.now());
  };

  const draw = (t: number) => {
    const { clientWidth: w, clientHeight: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const tw = animate ? 0.55 + 0.45 * Math.sin(t / 1000 * s.speed + s.phase) : 1;
      ctx.globalAlpha = s.base * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#F4F1E8';
      ctx.fill();
    }
    if (running) raf = requestAnimationFrame(draw);
  };

  const io = new IntersectionObserver(([e]) => {
    const visible = e.isIntersecting && animate;
    if (visible && !running) {
      running = true;
      raf = requestAnimationFrame(draw);
    } else if (!visible) {
      running = false;
      cancelAnimationFrame(raf);
    }
  });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
  };
}

export function initR1() {
  const hero = document.querySelector<HTMLElement>('[data-r1]');
  if (!hero) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = <T extends Element = HTMLElement>(s: string) => hero.querySelector<T>(s)!;

  const stopStars = starField(q<HTMLCanvasElement>('[data-r1-stars]'), !reduce);
  if (reduce) {
    document.addEventListener('astro:before-swap', stopStars, { once: true });
    return;
  }

  // One timeline, 0 → 1 across the hero's scroll distance.
  // Order of the sky: orange fades → purple fades → stars come out.
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6, // a little lag makes the scrub feel physical, not mechanical
        invalidateOnRefresh: true, // re-measure the sun drop on resize/rotate
      },
    });

    // Drop the sun until its bright core is hidden behind the back ridge. Measured
    // from layout (offsetTop ignores transforms) so a refresh mid-scroll stays correct.
    // The ridges cover the bottom --ridge-h of the stage (42%, 30% on phones); the far rim
    // (back crest) sits ~22% down the ridge layer.
    const sun = q('[data-r1-sun]');
    const stage = q('.r1__stage');
    // Phones: the headline wraps to 2–4 lines depending on the width, so a fixed `top` lands the
    // sun on the buttons on small screens. Start it just under the buttons instead; when the screen
    // is too short for that, it starts low, already touching the far rim (a sun near the horizon).
    const actions = q('.r1__actions');
    const ridgeLine = () => {
      const rh = parseFloat(getComputedStyle(stage).getPropertyValue('--ridge-h')) || 0.42;
      return stage.clientHeight * (1 - rh + rh * 0.22);
    };
    const placeSun = () => {
      sun.style.top = '';
      stage.removeAttribute('data-no-sun');
      if (!matchMedia('(max-width: 767px)').matches) return;
      const r = sun.offsetHeight / 2;
      // measured against the stage (the buttons sit inside the copy block, so offsetTop won't do);
      // the sun's top is its centre (negative margin), and the halo reaches ~1.7r around it
      const btnBottom = actions.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
      const below = btnBottom + r * 1.8;
      const cap = ridgeLine() - r * 0.6; // never start under the rim: at most, the core sits right on it
      // too short a screen (iPhone SE): no sky left between the buttons and the rim, so no disc;
      // the sky still goes gold → purple → night
      stage.toggleAttribute('data-no-sun', below > cap);
      sun.style.top = `${Math.min(Math.max(below, sun.offsetTop), cap)}px`;
    };
    placeSun();
    ScrollTrigger.addEventListener('refreshInit', placeSun);
    // the hot core just below the far rim (never upward, even when the sun starts low)
    const sunDrop = () => Math.max(0, ridgeLine() - sun.offsetTop + sun.offsetHeight * 0.2);

    // Night arrives by ~55% of the scroll and then holds
    tl.to(sun, { y: sunDrop, duration: 0.45, ease: 'power1.in' }, 0)
      .to(sun, { autoAlpha: 0, duration: 0.12 }, 0.4)
      .to('[data-r1-gold]', { autoAlpha: 0, duration: 0.3 }, 0)
      .to('[data-r1-glow]', { autoAlpha: 0, duration: 0.4 }, 0.05)
      .to('[data-r1-dusk]', { autoAlpha: 0, duration: 0.35 }, 0.15)
      .to('[data-r1-stars]', { autoAlpha: 1, duration: 0.3 }, 0.25)
      .fromTo('[data-r1-night]', { yPercent: 0 }, { yPercent: -4, duration: 1 }, 0)
      // Parallax: the closer the ridge, the further it travels
      .to('[data-r1-ridge="back"]', { yPercent: 2, duration: 1 }, 0)
      .to('[data-r1-ridge="mid"]', { yPercent: 6, duration: 1 }, 0)
      .to('[data-r1-ridge="front"]', { yPercent: 11, duration: 1 }, 0)
      // the rock darkens with the sky
      .to('[data-r1-shade]', { opacity: 0.55, duration: 0.45 }, 0.2)
      // the haze thins as the light goes, leaving a faint violet veil at night
      .to('[data-r1-haze]', { opacity: 0.5, duration: 0.6 }, 0.25)
      ;
    // runs on ctx.revert()
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', placeSun);
      sun.style.top = '';
      stage.removeAttribute('data-no-sun');
    };
  }, hero);

  document.addEventListener(
    'astro:before-swap',
    () => {
      ctx.revert(); // kills the timeline + ScrollTrigger and restores inline styles
      stopStars();
    },
    { once: true },
  );
}
