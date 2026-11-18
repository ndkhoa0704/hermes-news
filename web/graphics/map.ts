// Bản đồ: Việt Nam (kèm Hoàng Sa, Trường Sa), thế giới, hoặc "local" (nền phố giản lược + bản đồ định vị nhỏ).
import { esc, f1, fmt } from "./util";

type Ring = [number, number][];
interface Country { id: string; name: string; polys: Ring[][] }
interface Pt { key: string; lat: number; lon: number; value?: number; note?: string; highlight?: boolean }

const cache = new Map<string, Promise<Country[]>>();
const load = (name: "world" | "sea") => {
  if (!cache.has(name)) cache.set(name, fetch(`/geo/${name}.json`).then((r) => r.json()));
  return cache.get(name)!;
};

const VN_ID = "704";
const ISLANDS = [
  { name: "Q.đ. Hoàng Sa", lat: 16.5, lon: 112.0 },
  { name: "Q.đ. Trường Sa", lat: 9.5, lon: 114.0 },
];

function projector(bbox: [number, number, number, number], W: number, H: number) {
  const [x0, y0, x1, y1] = bbox;
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const sx = W / ((x1 - x0) * k);
  const sy = H / (y1 - y0);
  const s = Math.min(sx, sy);
  const ox = (W - (x1 - x0) * k * s) / 2;
  const oy = (H - (y1 - y0) * s) / 2;
  return (lon: number, lat: number): [number, number] => [ox + (lon - x0) * k * s, oy + (y1 - lat) * s];
}

function pathOf(c: Country, p: (lon: number, lat: number) => [number, number]): string {
  return c.polys
    .map((poly) => poly.map((ring) => "M" + ring.map(([lo, la]) => p(lo, la).map(f1).join(",")).join("L") + "Z").join(""))
    .join("");
}

function pointsSvg(points: Pt[], p: (lon: number, lat: number) => [number, number], W: number): string {
  const maxV = Math.max(1, ...points.map((q) => q.value ?? 0));
  return points
    .map((q, i) => {
      const [x, y] = p(q.lon, q.lat);
      const r = q.value ? 5 + Math.sqrt(q.value / maxV) * 16 : q.highlight ? 7 : 5;
      const right = x < W * 0.7;
      return `<g class="map-pt${q.highlight ? " hot" : ""}" data-key="${esc(q.key)}" style="--i:${i}">
<circle class="pulse" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>
<text x="${f1(right ? x + r + 6 : x - r - 6)}" y="${f1(y + 4)}" text-anchor="${right ? "start" : "end"}">${esc(q.key)}${q.value ? ` · ${fmt(q.value)}` : ""}</text></g>`;
    })
    .join("");
}

export async function renderMap(el: HTMLElement, scope: "vietnam" | "world" | "local", points: Pt[]) {
  const W = 800, H = scope === "world" ? 440 : 620;
  let svg = "";
  if (scope === "world") {
    const world = await load("world");
    const p = projector([-170, -58, 190, 80], W, H);
    svg = world.map((c) => `<path class="land${c.id === VN_ID ? " vn" : ""}" d="${pathOf(c, p)}"/>`).join("") + pointsSvg(points, p, W);
  } else if (scope === "vietnam") {
    const sea = await load("sea");
    // khung: Việt Nam + điểm nằm ngoài (nếu có)
    let bb: [number, number, number, number] = [101.5, 7.5, 116.5, 23.8];
    for (const q of points) bb = [Math.min(bb[0], q.lon - 1), Math.min(bb[1], q.lat - 1), Math.max(bb[2], q.lon + 1), Math.max(bb[3], q.lat + 1)];
    const p = projector(bb, W, H);
    svg =
      `<rect class="sea" width="${W}" height="${H}"/>` +
      sea.map((c) => `<path class="land${c.id === VN_ID ? " vn" : ""}" d="${pathOf(c, p)}"/>`).join("") +
      ISLANDS.map((is) => {
        const [x, y] = p(is.lon, is.lat);
        return `<g class="islands"><circle cx="${f1(x)}" cy="${f1(y)}" r="2.2"/><circle cx="${f1(x + 6)}" cy="${f1(y + 4)}" r="1.6"/><circle cx="${f1(x - 5)}" cy="${f1(y + 6)}" r="1.4"/><text x="${f1(x)}" y="${f1(y + 20)}" text-anchor="middle">${is.name}</text></g>`;
      }).join("") +
      pointsSvg(points, p, W);
  } else {
    // local: nền phố giản lược, điểm đặt theo toạ độ tương đối
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of points) { x0 = Math.min(x0, q.lon); x1 = Math.max(x1, q.lon); y0 = Math.min(y0, q.lat); y1 = Math.max(y1, q.lat); }
    const span = Math.max(0.02, x1 - x0, y1 - y0) * 0.75;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const p = projector([cx - span, cy - span * 0.8, cx + span, cy + span * 0.8], W, H);
    let streets = "";
    for (let i = 0; i < 26; i++) {
      const a = (i * 137.5) % 180;
      const o = (i * 61) % W;
      streets += `<line x1="${o}" y1="0" x2="${f1(o + Math.cos((a * Math.PI) / 180) * 900)}" y2="${H}" class="street${i % 5 === 0 ? " main" : ""}"/>`;
    }
    for (let i = 0; i < 14; i++) streets += `<line x1="0" y1="${(i * 47) % H}" x2="${W}" y2="${f1(((i * 47) % H) + (i % 2 ? 60 : -40))}" class="street${i % 4 === 0 ? " main" : ""}"/>`;
    svg = `<rect class="ground" width="${W}" height="${H}"/>${streets}` + pointsSvg(points, p, W);
    // bản đồ định vị nhỏ
    const sea = await load("sea");
    const IW = 150, IH = 230;
    const ip = projector([101.5, 7.5, 116.5, 23.8], IW, IH);
    const [lx, ly] = ip(cx, cy);
    svg += `<g transform="translate(${W - IW - 12} 12)"><rect class="inset" width="${IW}" height="${IH}" rx="6"/>${sea
      .filter((c) => c.id === VN_ID)
      .map((c) => `<path class="land vn" d="${pathOf(c, ip)}"/>`)
      .join("")}<circle cx="${f1(lx)}" cy="${f1(ly)}" r="5" class="locator"/></g>`;
  }
  el.innerHTML = `<svg class="g-map ${scope}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
}
