// Build-time topographic contours of a Makhtesh-Ramon-shaped crater.
//
// A height field models the real landform's character: a long teardrop basin
// running south-west → north-east, wide at the south-west end and narrowing to
// the north-east, sunk into a gently tilted plateau, with a raised rim and
// low hills on the floor. Marching squares traces iso-lines at fixed heights,
// segments are chained into polylines, and the result is emitted as compact
// SVG path data. Deterministic (seeded noise), so every build draws the same map.

export interface TopoMap {
  width: number;
  height: number;
  /** One path string per level, lowest first */
  levels: { d: string; index: boolean }[];
  /** The crater axis end points, for labels */
  axis: { a: [number, number]; b: [number, number] };
  /** A point on the north-west rim where the lodge sits */
  lodge: [number, number];
  /** Mitzpe Ramon (the town), just north of the lodge */
  town: [number, number];
}

const W = 1000;
const H = 600;
const A: [number, number] = [150, 455]; // south-west end of the crater axis
const B: [number, number] = [885, 165]; // north-east end

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a lattice, summed over three octaves */
function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const N = 64;
  const lattice = Array.from({ length: N * N }, rnd);
  const at = (i: number, j: number) => lattice[((j % N) + N) % N * N + (((i % N) + N) % N)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const value = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = smooth(x - xi), ty = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return (x: number, y: number) =>
    value(x / 90, y / 90) * 0.55 + value(x / 40, y / 40) * 0.3 + value(x / 18, y / 18) * 0.15;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function heightAt(x0: number, y0: number, noise: (x: number, y: number) => number) {
  // Domain warp: bend the coordinates with noise so the rim reads as eroded rock, not a stadium
  const x = x0 + 70 * (noise(x0 + 311, y0 + 97) - 0.5);
  const y = y0 + 70 * (noise(x0 - 173, y0 + 419) - 0.5);
  const ax = B[0] - A[0], ay = B[1] - A[1];
  const len2 = ax * ax + ay * ay;
  const t = ((x - A[0]) * ax + (y - A[1]) * ay) / len2;
  const tc = Math.min(1, Math.max(0, t));
  const px = A[0] + ax * tc, py = A[1] + ay * tc;
  const dist = Math.hypot(x - px, y - py);
  // Teardrop: wide at the south-west, narrowing north-east; rounded ends
  const halfW = 165 - 115 * Math.pow(tc, 0.85);
  const r = dist / halfW;
  // Gentle inner slope so contour lines spread out; a sharp cliff only near the rim
  const basin = 1 - 0.55 * smoothstep(0.25, 0.85, r) - 0.45 * smoothstep(0.85, 1.08, r);
  const rim = 0.1 * Math.exp(-(((r - 1.1) / 0.18) ** 2));
  const plateau = 0.62 + 0.14 * (x / W) - 0.06 * (y / H);
  const n = noise(x, y);
  const floorHills = 0.16 * n * (1 - smoothstep(0.55, 0.95, r));
  return plateau - 0.62 * basin + rim + 0.11 * n + floorHills;
}

type Pt = [number, number];

/** Marching squares for one level → chained polylines */
function contour(grid: Float32Array, cols: number, rows: number, step: number, level: number): Pt[][] {
  const segs: [Pt, Pt][] = [];
  const v = (i: number, j: number) => grid[j * cols + i];
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * step, y = j * step;
      const top: Pt = [x + step * lerp(a, b), y];
      const right: Pt = [x + step, y + step * lerp(b, c)];
      const bottom: Pt = [x + step * lerp(d, c), y + step];
      const left: Pt = [x, y + step * lerp(a, d)];
      const table: Record<number, [Pt, Pt][]> = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
        9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const s of table[idx]) segs.push(s);
    }
  }
  // Chain segments sharing end points into polylines
  const key = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const byPoint = new Map<string, number[]>();
  segs.forEach(([p, q], k) => {
    for (const pt of [p, q]) {
      const kk = key(pt);
      if (!byPoint.has(kk)) byPoint.set(kk, []);
      byPoint.get(kk)!.push(k);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines: Pt[][] = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const line: Pt[] = [segs[k][0], segs[k][1]];
    for (const forward of [true, false]) {
      for (;;) {
        const end = forward ? line[line.length - 1] : line[0];
        const next = (byPoint.get(key(end)) ?? []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const [p, q] = segs[next];
        const other = key(p) === key(end) ? q : p;
        if (forward) line.push(other);
        else line.unshift(other);
      }
    }
    if (line.length > 3) lines.push(line);
  }
  return lines;
}

/** Drop points closer than `tol` to keep the SVG small */
function thin(line: Pt[], tol: number): Pt[] {
  const out: Pt[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const p = out[out.length - 1];
    if (Math.hypot(line[i][0] - p[0], line[i][1] - p[1]) >= tol) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

const toPath = (lines: Pt[][]) =>
  lines
    .map((l) => 'M' + l.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L'))
    .join('');

let cache: TopoMap | null = null;

export function ramonTopo(): TopoMap {
  if (cache) return cache;
  const noise = makeNoise(1981); // seeded: the same map on every build
  const step = 6;
  const cols = Math.floor(W / step) + 1;
  const rows = Math.floor(H / step) + 1;
  const grid = new Float32Array(cols * rows);
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const h = heightAt(i * step, j * step, noise);
      grid[j * cols + i] = h;
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  const count = 26;
  const levels = Array.from({ length: count }, (_, n) => {
    const level = min + ((n + 0.5) / count) * (max - min);
    return { d: toPath(contour(grid, cols, rows, step, level).map((l) => thin(l, 4))), index: n % 5 === 0 };
  });
  // The lodge: on the north-west rim, just past the middle of the crater
  const t = 0.58;
  const ax = B[0] - A[0], ay = B[1] - A[1];
  const len = Math.hypot(ax, ay);
  const nx = ay / len, ny = -ax / len; // normal pointing north-west
  const cx = A[0] + ax * t, cy = A[1] + ay * t;
  const halfW = 165 - 115 * Math.pow(t, 0.85);
  const lodge: [number, number] = [Math.round(cx + nx * halfW * 1.1), Math.round(cy + ny * halfW * 1.1)];
  const town: [number, number] = [Math.round(cx + nx * halfW * 1.9 + 30), Math.round(cy + ny * halfW * 1.9)];
  cache = { width: W, height: H, levels, axis: { a: A, b: B }, lodge, town };
  return cache;
}
