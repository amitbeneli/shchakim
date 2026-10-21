// /topo.svg: the crater contours as a static, cacheable file, used as a faint
// map texture behind sections (CSS background) without inlining 60 KB twice.
import type { APIRoute } from 'astro';
import { ramonTopo } from '../lib/topo';

export const GET: APIRoute = () => {
  const t = ramonTopo();
  const paths = t.levels
    .map((l) => `<path d="${l.d}" stroke-opacity="${l.index ? 0.55 : 0.25}" stroke-width="${l.index ? 1.2 : 0.7}"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.width} ${t.height}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#d9a86c">${paths}</g></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
