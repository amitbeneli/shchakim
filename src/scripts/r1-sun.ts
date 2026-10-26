// Where the sun starts, measured from layout. Kept apart from the GSAP scene (r1.ts) so it runs
// right away on page load: the scene itself loads later, after the hero has painted.

// The ridges cover the bottom --ridge-h of the stage (42%, 30% on phones); the far rim
// (back crest) sits ~22% down the ridge layer.
export function ridgeLine(stage: HTMLElement) {
  const rh = parseFloat(getComputedStyle(stage).getPropertyValue('--ridge-h')) || 0.42;
  return stage.clientHeight * (1 - rh + rh * 0.22);
}

// Phones: the headline wraps to 2–4 lines depending on the width, so a fixed `top` lands the
// sun on the buttons on small screens. Start it just under the buttons instead; when the screen
// is too short for that, it starts low, already touching the far rim (a sun near the horizon).
export function placeSun(hero: HTMLElement) {
  const sun = hero.querySelector<HTMLElement>('[data-r1-sun]');
  const stage = hero.querySelector<HTMLElement>('.r1__stage');
  const actions = hero.querySelector<HTMLElement>('.r1__actions');
  if (!sun || !stage || !actions) return;
  sun.style.top = '';
  stage.removeAttribute('data-no-sun');
  if (!matchMedia('(max-width: 767px)').matches) return;
  const r = sun.offsetHeight / 2;
  // measured against the stage (the buttons sit inside the copy block, so offsetTop won't do);
  // the sun's top is its centre (negative margin), and the halo reaches ~1.7r around it
  const btnBottom = actions.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
  const below = btnBottom + r * 1.8;
  const cap = ridgeLine(stage) - r * 0.6; // never start under the rim: at most, the core sits right on it
  // too short a screen (iPhone SE): no sky left between the buttons and the rim, so no disc;
  // the sky still goes gold → purple → night
  stage.toggleAttribute('data-no-sun', below > cap);
  sun.style.top = `${Math.min(Math.max(below, sun.offsetTop), cap)}px`;
}
