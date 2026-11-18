// Trình vẽ ảnh trừu tượng (SVG) từ ArtSpec do Hermes chọn. Dùng được cả ở server lẫn trình duyệt.
// Mỗi câu chuyện có seed riêng → hình khác nhau nhưng ổn định giữa các lần tải.
import type { ArtSpec } from "./types";

const W = 400;
const H = 250;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let a = hashStr(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

interface Ctx {
  r: () => number;
  pal: string[]; // pal[0] nền, còn lại là màu nhấn
  e: number;
  d: number;
  id: string;
  pick: () => string;
  between: (a: number, b: number) => number;
}

type Painter = (c: Ctx) => string;

const waves: Painter = ({ r, e, d, pick, between }) => {
  const n = Math.round(6 + d * 14);
  let s = "";
  for (let i = 0; i < n; i++) {
    const y0 = (H / (n + 1)) * (i + 1) + between(-10, 10);
    const amp = 8 + e * 38 * r();
    const freq = between(1, 2.5 + e * 2);
    const ph = r() * Math.PI * 2;
    let p = `M -10 ${f(y0)}`;
    for (let x = -10; x <= W + 10; x += 10) p += ` L ${x} ${f(y0 + Math.sin((x / W) * Math.PI * 2 * freq + ph) * amp)}`;
    s += `<path d="${p}" fill="none" stroke="${pick()}" stroke-width="${f(1 + r() * 3 * (1 - d * 0.5))}" stroke-opacity="${f(0.35 + r() * 0.6)}" stroke-linecap="round"/>`;
  }
  return s;
};

const rise: Painter = ({ r, e, d, pick, between, id }) => {
  const n = Math.round(8 + d * 18);
  const bw = W / n;
  let s = "";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const h = 20 + t * (H * (0.45 + e * 0.4)) + between(-18, 18);
    s += `<rect x="${f(i * bw + bw * 0.15)}" y="${f(H - h)}" width="${f(bw * 0.7)}" height="${f(h)}" rx="${f(bw * 0.2)}" fill="url(#${id}-v)" opacity="${f(0.45 + t * 0.5)}"/>`;
  }
  let p = `M 0 ${H - 30}`;
  for (let x = 0; x <= W; x += 20) p += ` L ${x} ${f(H - 30 - (x / W) ** 1.6 * H * (0.55 + e * 0.3) + between(-6, 6))}`;
  s += `<path d="${p}" fill="none" stroke="${pick()}" stroke-width="4" stroke-linecap="round" filter="url(#${id}-glow)"/>`;
  s += `<circle cx="${W - 18}" cy="${f(H * 0.18 - e * 20)}" r="${f(8 + e * 8)}" fill="${pick()}" filter="url(#${id}-glow)"/>`;
  return s;
};

const fall: Painter = ({ r, e, d, pick, between, id }) => {
  const n = Math.round(8 + d * 14);
  const bw = W / n;
  let s = "";
  for (let i = 0; i < n; i++) {
    const t = 1 - i / (n - 1);
    const h = 18 + t * H * 0.7 + between(-14, 14);
    s += `<rect x="${f(i * bw + bw * 0.15)}" y="${f(H - h)}" width="${f(bw * 0.7)}" height="${f(h)}" rx="3" fill="url(#${id}-v)" opacity="${f(0.3 + t * 0.6)}"/>`;
  }
  const drops = Math.round(20 + e * 60);
  for (let i = 0; i < drops; i++) {
    const x = r() * W;
    const y = r() * H;
    const len = 6 + e * 22 * r();
    s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + len * 0.25)}" y2="${f(y + len)}" stroke="${pick()}" stroke-width="1.5" stroke-opacity="${f(0.3 + r() * 0.5)}"/>`;
  }
  let p = `M 0 30`;
  for (let x = 0; x <= W; x += 20) p += ` L ${x} ${f(30 + (x / W) ** 1.4 * H * 0.7 + between(-8, 8) * e)}`;
  s += `<path d="${p}" fill="none" stroke="${pick()}" stroke-width="4" filter="url(#${id}-glow)"/>`;
  return s;
};

const network: Painter = ({ r, e, d, pick, id }) => {
  const n = Math.round(14 + d * 30);
  const pts = Array.from({ length: n }, () => [r() * W, r() * H] as const);
  const maxD = 70 + e * 60;
  let s = "";
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = pts[i]![0] - pts[j]![0];
      const dy = pts[i]![1] - pts[j]![1];
      const dist = Math.hypot(dx, dy);
      if (dist < maxD) s += `<line x1="${f(pts[i]![0])}" y1="${f(pts[i]![1])}" x2="${f(pts[j]![0])}" y2="${f(pts[j]![1])}" stroke="${pick()}" stroke-opacity="${f(0.15 + (1 - dist / maxD) * 0.6)}" stroke-width="1.2"/>`;
    }
  for (const [x, y] of pts) {
    const rad = 2 + r() * (3 + e * 5);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="${pick()}" filter="url(#${id}-glow)"/>`;
  }
  return s;
};

const orbit: Painter = ({ r, e, d, pick, id, between }) => {
  const cx = between(W * 0.35, W * 0.65);
  const cy = between(H * 0.4, H * 0.6);
  const rings = Math.round(4 + d * 6);
  let s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(18 + e * 14)}" fill="url(#${id}-r)" filter="url(#${id}-glow)"/>`;
  for (let i = 1; i <= rings; i++) {
    const rx = 30 + i * (W / 2 / rings);
    const ry = rx * between(0.3, 0.5);
    const rot = between(-25, 25);
    const col = pick();
    s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="${col}" stroke-opacity="${f(0.25 + r() * 0.4)}" stroke-dasharray="${r() > 0.5 ? "4 6" : "none"}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"/>`;
    const a = r() * Math.PI * 2;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    s += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(3 + r() * 6)}" fill="${col}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" filter="url(#${id}-glow)"/>`;
  }
  for (let i = 0; i < 40 * d + 20; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(r() * 1.3)}" fill="#fff" opacity="${f(r() * 0.7)}"/>`;
  return s;
};

const shards: Painter = ({ r, e, d, pick, between, id }) => {
  const cx = between(W * 0.3, W * 0.7);
  const cy = between(H * 0.3, H * 0.7);
  const n = Math.round(14 + d * 26);
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const dist = 10 + r() * (W * 0.6) * (0.4 + e * 0.6);
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist;
    const sz = 8 + r() * 34 * (1 - dist / W);
    const pts = [0, 1, 2].map(() => `${f(x + between(-sz, sz))},${f(y + between(-sz, sz))}`).join(" ");
    s += `<polygon points="${pts}" fill="${pick()}" opacity="${f(0.35 + r() * 0.6)}"/>`;
  }
  for (let i = 0; i < 8 + e * 10; i++) {
    let x = cx, y = cy, p = `M ${f(x)} ${f(y)}`;
    const a = r() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      x += Math.cos(a + between(-0.5, 0.5)) * 25;
      y += Math.sin(a + between(-0.5, 0.5)) * 25;
      p += ` L ${f(x)} ${f(y)}`;
    }
    s += `<path d="${p}" fill="none" stroke="${pick()}" stroke-width="1.4" stroke-opacity="0.8"/>`;
  }
  s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(6 + e * 10)}" fill="${pick()}" filter="url(#${id}-glow)"/>`;
  return s;
};

const bloom: Painter = ({ r, e, d, pick, between, id }) => {
  const flowers = Math.round(2 + d * 5);
  let s = "";
  for (let k = 0; k < flowers; k++) {
    const cx = between(30, W - 30);
    const cy = between(30, H - 30);
    const petals = Math.round(between(6, 12));
    const len = between(18, 45) * (0.7 + e * 0.5);
    const col = pick();
    for (let i = 0; i < petals; i++) {
      const rot = (360 / petals) * i;
      s += `<ellipse cx="${f(cx)}" cy="${f(cy - len / 2)}" rx="${f(len * 0.28)}" ry="${f(len / 2)}" fill="${col}" opacity="${f(0.35 + r() * 0.35)}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"/>`;
    }
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(len * 0.18)}" fill="${pick()}" filter="url(#${id}-glow)"/>`;
  }
  for (let i = 0; i < 30; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(1 + r() * 2.5)}" fill="${pick()}" opacity="${f(r() * 0.6)}"/>`;
  return s;
};

const grid: Painter = ({ r, e, d, pick, between, id }) => {
  let s = "";
  for (let x = 0; x <= W; x += 20) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${pick()}" stroke-opacity="0.08"/>`;
  for (let y = 0; y <= H; y += 20) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${pick()}" stroke-opacity="0.08"/>`;
  let x = -5;
  while (x < W) {
    const w = between(14, 40) * (1.2 - d * 0.5);
    const h = between(30, H * (0.5 + e * 0.4));
    s += `<rect x="${f(x)}" y="${f(H - h)}" width="${f(w)}" height="${f(h)}" fill="url(#${id}-v)" opacity="${f(0.55 + r() * 0.4)}"/>`;
    for (let wy = H - h + 8; wy < H - 6; wy += 10)
      for (let wx = x + 4; wx < x + w - 4; wx += 7) if (r() < 0.35 + e * 0.3) s += `<rect x="${f(wx)}" y="${f(wy)}" width="3" height="4" fill="${pick()}" opacity="${f(0.5 + r() * 0.5)}"/>`;
    x += w + between(1, 5);
  }
  return s;
};

const pulse: Painter = ({ r, e, d, pick, between, id }) => {
  let s = "";
  const cx = between(W * 0.3, W * 0.7);
  const cy = H / 2;
  for (let i = 1; i <= 4 + d * 6; i++) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(i * 22)}" fill="none" stroke="${pick()}" stroke-opacity="${f(0.5 / i + 0.05)}" stroke-width="2"/>`;
  const lines = Math.round(1 + d * 2);
  for (let k = 0; k < lines; k++) {
    let p = `M 0 ${f(cy + k * 18)}`;
    let x = 0;
    while (x < W) {
      x += between(15, 35);
      if (r() < 0.3 + e * 0.3) {
        const amp = 30 + e * 70;
        p += ` L ${f(x)} ${f(cy + k * 18)} L ${f(x + 5)} ${f(cy - amp * r())} L ${f(x + 10)} ${f(cy + amp * 0.6 * r())} L ${f(x + 15)} ${f(cy + k * 18)}`;
        x += 15;
      } else p += ` L ${f(x)} ${f(cy + k * 18)}`;
    }
    s += `<path d="${p}" fill="none" stroke="${pick()}" stroke-width="${k === 0 ? 3 : 1.5}" stroke-linejoin="round" filter="url(#${id}-glow)"/>`;
  }
  return s;
};

const spiral: Painter = ({ r, e, d, pick, between, id }) => {
  const cx = between(W * 0.35, W * 0.65);
  const cy = between(H * 0.35, H * 0.65);
  const arms = Math.round(2 + d * 4);
  let s = "";
  for (let a = 0; a < arms; a++) {
    const off = (Math.PI * 2 * a) / arms;
    const col = pick();
    const steps = 120 + d * 100;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const ang = off + t * Math.PI * (4 + e * 4);
      const rad = t * W * 0.55;
      const x = cx + Math.cos(ang) * rad + between(-3, 3) * e;
      const y = cy + Math.sin(ang) * rad * 0.7 + between(-3, 3) * e;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + t * 3.5)}" fill="${col}" opacity="${f(0.2 + (1 - t) * 0.7)}"/>`;
    }
  }
  s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="10" fill="${pick()}" filter="url(#${id}-glow)"/>`;
  return s;
};

const ripples: Painter = ({ r, e, d, pick, between, id }) => {
  const centers = Math.round(1 + d * 2);
  let s = "";
  for (let k = 0; k < centers; k++) {
    const cx = between(W * 0.2, W * 0.8);
    const cy = between(H * 0.25, H * 0.75);
    const col = pick();
    const rings = 6 + Math.round(e * 8);
    for (let i = 1; i <= rings; i++) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(i * (12 + e * 10))}" fill="none" stroke="${col}" stroke-width="${f(2.5 - i * 0.12)}" stroke-opacity="${f(Math.max(0.05, 0.85 - i / rings))}"/>`;
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="6" fill="${col}" filter="url(#${id}-glow)"/>`;
  }
  return s;
};

const particles: Painter = ({ r, e, d, pick, between }) => {
  const n = Math.round(120 + d * 380);
  const fx = between(0.005, 0.02);
  const fy = between(0.005, 0.02);
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H;
    const ang = Math.sin(x * fx) * Math.cos(y * fy) * Math.PI * 2;
    const len = 2 + e * 12;
    s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + Math.cos(ang) * len)}" y2="${f(y + Math.sin(ang) * len)}" stroke="${pick()}" stroke-width="${f(1 + r() * 2)}" stroke-linecap="round" stroke-opacity="${f(0.3 + r() * 0.7)}"/>`;
  }
  return s;
};

const mountains: Painter = ({ r, e, d, pick, between, id }) => {
  let s = `<circle cx="${f(between(W * 0.2, W * 0.8))}" cy="${f(between(H * 0.2, H * 0.35))}" r="${f(22 + e * 12)}" fill="${pick()}" filter="url(#${id}-glow)" opacity="0.9"/>`;
  const layers = Math.round(3 + d * 3);
  for (let l = 0; l < layers; l++) {
    const base = H * 0.45 + (l / layers) * H * 0.45;
    let p = `M 0 ${H} L 0 ${f(base)}`;
    let y = base;
    for (let x = 0; x <= W; x += 16) {
      y = Math.min(H - 5, Math.max(H * 0.2, y + between(-14, 14) * (0.5 + e)));
      p += ` L ${x} ${f(y)}`;
    }
    p += ` L ${W} ${H} Z`;
    s += `<path d="${p}" fill="${pick()}" opacity="${f(0.35 + (l / layers) * 0.6)}"/>`;
  }
  return s;
};

const PAINTERS: Record<ArtSpec["motif"], Painter> = { waves, rise, fall, network, orbit, shards, bloom, grid, pulse, spiral, ripples, particles, mountains };

/** Trả về chuỗi SVG cho một câu chuyện. */
export function renderArt(spec: ArtSpec, seed: string): string {
  const r = rng(seed + spec.motif);
  const pal = spec.palette.length >= 2 ? spec.palette : ["#111827", "#60a5fa", "#f472b6"];
  const bg = pal[0]!;
  const accents = pal.slice(1);
  const id = "art" + hashStr(seed).toString(36);
  const ctx: Ctx = {
    r,
    pal,
    e: spec.energy,
    d: spec.density,
    id,
    pick: () => accents[Math.floor(r() * accents.length)]!,
    between: (a, b) => a + r() * (b - a),
  };
  const a1 = accents[0]!;
  const a2 = accents[accents.length - 1]!;
  const body = (PAINTERS[spec.motif] ?? ripples)(ctx);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${(spec.caption || spec.motif).replace(/"/g, "&quot;")}">
<defs>
<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${a1}" stop-opacity="0.35"/></linearGradient>
<linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a1}"/><stop offset="1" stop-color="${a2}" stop-opacity="0.3"/></linearGradient>
<radialGradient id="${id}-r"><stop offset="0" stop-color="#fff"/><stop offset="0.4" stop-color="${a1}"/><stop offset="1" stop-color="${a2}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity="0.85"/></radialGradient>
<filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#${id}-bg)"/>
${body}
<rect width="${W}" height="${H}" fill="url(#${id}-vig)"/>
</svg>`;
}
