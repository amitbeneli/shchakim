// Night ambience, synthesized: a bed of low wind (brown noise through a slowly
// wandering low-pass filter) and sparse cricket chirps (short high sine pulses,
// randomly timed and panned). Nothing plays until the visitor presses the button.

const KEY = 'shchakim-sound';
const LEVEL = 0.55;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let chirpTimer = 0;
let playing = false;

function build() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Wind: 4 s of brown noise, looped
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.2;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 0.6;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.22;
  // slow gusts: LFOs on the filter and on the level
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 220;
  lfo.connect(lfoDepth).connect(lp.frequency);
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.045;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.1;
  gust.connect(gustDepth).connect(windGain.gain);
  noise.connect(lp).connect(windGain).connect(master);
  noise.start();
  lfo.start();
  gust.start();
}

// One cricket: 3–4 short pulses around 4.3 kHz
function chirp() {
  if (!ctx || !master || !playing) return;
  const t0 = ctx.currentTime + 0.02;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) {
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(master);
  }
  const out: AudioNode = pan ?? master;
  const pitch = 4100 + Math.random() * 500;
  const pulses = 3 + Math.round(Math.random());
  const vol = 0.025 + Math.random() * 0.03;
  for (let i = 0; i < pulses; i++) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = pitch;
    const g = ctx.createGain();
    const t = t0 + i * 0.045;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.035);
  }
  chirpTimer = window.setTimeout(chirp, 500 + Math.random() * 1900);
}

function fadeTo(v: number, seconds: number) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(v, now + seconds);
}

async function start() {
  if (!ctx) build();
  await ctx!.resume();
  playing = true;
  fadeTo(LEVEL, 2);
  clearTimeout(chirpTimer);
  chirpTimer = window.setTimeout(chirp, 900);
}

function stop() {
  playing = false;
  clearTimeout(chirpTimer);
  fadeTo(0, 1.2);
  window.setTimeout(() => !playing && ctx?.suspend(), 1300);
}

const remember = (on: boolean) => {
  try {
    sessionStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage may be unavailable */
  }
};
const wanted = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

function paint(btn: HTMLElement, on: boolean) {
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'השתקת צלילי לילה' : 'הפעלת צלילי לילה');
}

// Pause with the tab, resume when it comes back (only if the visitor had it on)
let visBound = false;
function bindVisibility() {
  if (visBound) return;
  visBound = true;
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (playing) ctx.resume();
  });
}

export function initAmbient() {
  const btn = document.querySelector<HTMLElement>('[data-snd]');
  if (!btn) return;
  bindVisibility();
  const ac = new AbortController();

  // Already playing from a previous page in this visit: just reflect it
  paint(btn, playing || wanted());

  // After a full reload the browser needs a gesture: if it was on, resume on the first one
  if (wanted() && !playing) {
    const resume = () => {
      if (wanted() && !playing) start();
    };
    window.addEventListener('pointerdown', resume, { once: true, signal: ac.signal });
    window.addEventListener('keydown', resume, { once: true, signal: ac.signal });
  }

  btn.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      const on = !playing;
      if (on) start();
      else stop();
      remember(on);
      paint(btn, on);
    },
    { signal: ac.signal },
  );

  document.addEventListener('astro:before-swap', () => ac.abort(), { once: true });
}
