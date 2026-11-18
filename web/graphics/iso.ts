// Mô hình 3D isometric bằng SVG: khối nhà có cửa sổ theo tầng, phần nhấn tô đỏ, bóng đổ, nền phố.
import type { IsoBlock } from "../../src/shared/visual-types";
import { esc, f1, rng } from "./util";

const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);
const U = 10; // px mỗi đơn vị lưới
const FH = 9; // px mỗi tầng

const proj = (x: number, y: number, z: number): [number, number] => [(x - y) * C * U, (x + y) * S * U - z * FH];
const pts = (arr: [number, number][]) => arr.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ");

const PAL = {
  normal: { left: "#f3f0ea", right: "#dcd5ca", top: "#fbfaf7", win: "#8e877d", winR: "#6f685f", edge: "#c9c1b4" },
  hot: { left: "#d4553e", right: "#b1402c", top: "#e46c54", win: "#7d2316", winR: "#5e170d", edge: "#9e3222" },
  house: { left: "#ece7de", right: "#d2cabd", top: "#a69d90", win: "#6f685f", winR: "#5c554c", edge: "#b8afa2" },
  tree: { a: "#9cc58f", b: "#7aa86c" },
};

interface Face {
  key: string;
  depth: number;
  svg: string;
}

function faceMatrix(ox: number, oy: number, dirX: number, dirY: number): string {
  // phép biến đổi: u (đơn vị lưới theo cạnh) → (dirX,dirY)*U ; v (tầng, hướng xuống) → (0, FH)
  return `matrix(${f1(dirX * U)} ${f1(dirY * U)} 0 ${FH} ${f1(ox)} ${f1(oy)})`;
}

function blockSvg(b: IsoBlock, id: string): string {
  const z0 = b.z ?? 0;
  const z1 = z0 + b.floors;
  const { x, y, w, d } = b;
  const isHouse = b.kind === "house";
  const pal = b.highlight ? PAL.hot : isHouse ? PAL.house : PAL.normal;
  const winId = b.kind === "base" ? `${id}-shop` : `${id}-win`;
  const winLid = b.highlight ? `${winId}-hot` : isHouse ? `${winId}-house` : winId;

  if (b.kind === "tree") {
    const [cx, cy] = proj(x + w / 2, y + d / 2, z0);
    const r = Math.max(w, d) * U * 0.45;
    return `<g class="iso-b" data-key="${esc(b.key)}"${b.showIn ? ` data-show="${esc(b.showIn.join(" "))}"` : ""}>
<ellipse cx="${f1(cx + r * 0.4)}" cy="${f1(cy)}" rx="${f1(r)}" ry="${f1(r * 0.45)}" fill="#000" opacity=".08"/>
<rect x="${f1(cx - 1.2)}" y="${f1(cy - r * 1.2)}" width="2.4" height="${f1(r * 1.2)}" fill="#8a6f52"/>
<circle cx="${f1(cx)}" cy="${f1(cy - r * 1.3)}" r="${f1(r)}" fill="${PAL.tree.a}"/><circle cx="${f1(cx + r * 0.3)}" cy="${f1(cy - r * 1.2)}" r="${f1(r * 0.6)}" fill="${PAL.tree.b}"/></g>`;
  }

  // toạ độ các đỉnh
  const L0 = proj(x, y + d, z1); // trên-trái của mặt trái
  const R0 = proj(x + w, y, z1); // trên-trái của mặt phải
  const left = pts([proj(x, y + d, z0), proj(x + w, y + d, z0), proj(x + w, y + d, z1), proj(x, y + d, z1)]);
  const right = pts([proj(x + w, y + d, z0), proj(x + w, y, z0), proj(x + w, y, z1), proj(x + w, y + d, z1)]);
  const top = pts([proj(x, y, z1), proj(x + w, y, z1), proj(x + w, y + d, z1), proj(x, y + d, z1)]);

  // dải tầng được tô nhấn (highlightFloors theo số tầng tuyệt đối)
  let hot = "";
  if (!b.highlight && b.highlightFloors) {
    const a = Math.max(z0, b.highlightFloors[0] - 1);
    const bb = Math.min(z1, b.highlightFloors[1]);
    if (bb > a) {
      const lf = pts([proj(x, y + d, a), proj(x + w, y + d, a), proj(x + w, y + d, bb), proj(x, y + d, bb)]);
      const rf = pts([proj(x + w, y + d, a), proj(x + w, y, a), proj(x + w, y, bb), proj(x + w, y + d, bb)]);
      const vTop = z1 - bb;
      const hh = bb - a;
      hot = `<polygon points="${lf}" fill="${PAL.hot.left}"/><polygon points="${rf}" fill="${PAL.hot.right}"/>
<g transform="${faceMatrix(L0[0], L0[1], C, S)}"><rect x="0" y="${f1(vTop)}" width="${f1(w)}" height="${f1(hh)}" fill="url(#${winId}-hot)"/></g>
<g transform="${faceMatrix(R0[0], R0[1], -C, S)}"><rect y="${f1(vTop)}" width="${f1(d)}" height="${f1(hh)}" fill="url(#${winId}-hotR)"/></g>`;
      if (bb >= z1) hot += `<polygon points="${top}" fill="${PAL.hot.top}"/>`;
    }
  }

  // thiết bị mái cho tháp
  let roof = "";
  if (b.kind === "tower" && w >= 4 && d >= 4) {
    const r = rng(b.key);
    for (let i = 0; i < 3; i++) {
      const bw = 1.2 + r() * 1.6;
      const bd = 1.2 + r() * 1.6;
      const bx = x + 0.6 + r() * (w - bw - 1.2);
      const by = y + 0.6 + r() * (d - bd - 1.2);
      const bz0 = z1;
      const bz1 = z1 + 0.9;
      roof += `<polygon points="${pts([proj(bx, by + bd, bz0), proj(bx + bw, by + bd, bz0), proj(bx + bw, by + bd, bz1), proj(bx, by + bd, bz1)])}" fill="#a39b90"/>`;
      roof += `<polygon points="${pts([proj(bx + bw, by + bd, bz0), proj(bx + bw, by, bz0), proj(bx + bw, by, bz1), proj(bx + bw, by + bd, bz1)])}" fill="#8a8277"/>`;
      roof += `<polygon points="${pts([proj(bx, by, bz1), proj(bx + bw, by, bz1), proj(bx + bw, by + bd, bz1), proj(bx, by + bd, bz1)])}" fill="#bdb6ab"/>`;
    }
  }

  const show = b.showIn ? ` data-show="${esc(b.showIn.join(" "))}"` : "";
  return `<g class="iso-b${b.highlight ? " hot" : ""}" data-key="${esc(b.key)}"${show}>
<polygon points="${left}" fill="${pal.left}" stroke="${pal.edge}" stroke-width=".4"/>
<g transform="${faceMatrix(L0[0], L0[1], C, S)}"><rect width="${f1(w)}" height="${f1(b.floors)}" fill="url(#${winLid})"/></g>
<polygon points="${right}" fill="${pal.right}" stroke="${pal.edge}" stroke-width=".4"/>
<g transform="${faceMatrix(R0[0], R0[1], -C, S)}"><rect width="${f1(d)}" height="${f1(b.floors)}" fill="url(#${winLid}R)"/></g>
<polygon points="${top}" fill="${pal.top}" stroke="${pal.edge}" stroke-width=".4"/>
${hot}${roof}</g>`;
}

function patterns(id: string): string {
  const win = (pid: string, col: string, bg: string, shop = false) =>
    shop
      ? `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="2" height="1"><rect width="2" height="1" fill="${bg}"/><rect x=".15" y=".2" width="1.7" height=".65" fill="${col}" opacity=".75"/></pattern>`
      : `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="1" height="1"><rect width="1" height="1" fill="${bg}"/><rect x=".22" y=".28" width=".56" height=".44" fill="${col}" opacity=".8"/></pattern>`;
  let s = "";
  for (const [suffix, shop] of [["win", false], ["shop", true]] as const) {
    const base = `${id}-${suffix}`;
    s += win(base, PAL.normal.win, PAL.normal.left, shop) + win(base + "R", PAL.normal.winR, PAL.normal.right, shop);
    s += win(base + "-hot", PAL.hot.win, PAL.hot.left, shop) + win(base + "-hotR", PAL.hot.winR, PAL.hot.right, shop);
    s += win(base + "-house", PAL.house.win, PAL.house.left, shop) + win(base + "-houseR", PAL.house.winR, PAL.house.right, shop);
  }
  return s;
}

export function renderIso(blocks: IsoBlock[], id: string, legend?: { normal: string; highlight: string }): string {
  // khung nhìn bao toàn bộ khối (mọi state) để chuyển cảnh không bị nhảy
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of blocks) {
    const z1 = (b.z ?? 0) + b.floors + 1;
    for (const [gx, gy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.d], [b.x + b.w, b.y + b.d]] as const)
      for (const z of [0, z1]) {
        const [px, py] = proj(gx, gy, z);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
  }
  const padX = (maxX - minX) * 0.12 + 30;
  const padY = (maxY - minY) * 0.08 + 30;
  const vb = [minX - padX, minY - padY - 14, maxX - minX + padX * 2, maxY - minY + padY * 2 + 14];

  // nền phố: lưới đường iso
  let ground = "";
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const b of blocks) { bx0 = Math.min(bx0, b.x); by0 = Math.min(by0, b.y); bx1 = Math.max(bx1, b.x + b.w); by1 = Math.max(by1, b.y + b.d); }
  const span = Math.max(bx1 - bx0, by1 - by0);
  const g0 = Math.min(bx0, by0) - span * 0.6, g1 = Math.max(bx1, by1) + span * 0.6;
  const step = Math.max(6, Math.round(span / 4));
  for (let k = Math.floor(g0 / step) * step; k <= g1; k += step) {
    ground += `<line x1="${f1(proj(k, g0, 0)[0])}" y1="${f1(proj(k, g0, 0)[1])}" x2="${f1(proj(k, g1, 0)[0])}" y2="${f1(proj(k, g1, 0)[1])}"/>`;
    ground += `<line x1="${f1(proj(g0, k, 0)[0])}" y1="${f1(proj(g0, k, 0)[1])}" x2="${f1(proj(g1, k, 0)[0])}" y2="${f1(proj(g1, k, 0)[1])}"/>`;
  }

  // bóng đổ (về phía -y, dài theo chiều cao)
  const shadows = blocks
    .filter((b) => b.kind !== "tree")
    .map((b) => {
      const L = ((b.z ?? 0) + b.floors) * 0.32;
      const p = pts([proj(b.x, b.y - L, 0), proj(b.x + b.w, b.y - L, 0), proj(b.x + b.w, b.y + b.d, 0), proj(b.x, b.y + b.d, 0)]);
      return `<polygon class="iso-sh" points="${p}"${b.showIn ? ` data-show="${esc(b.showIn.join(" "))}"` : ""}/>`;
    })
    .join("");

  // painter's algorithm: xa trước, gần sau; khối thấp z trước
  const sorted = [...blocks].sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2) || (a.z ?? 0) - (b.z ?? 0));
  const body = sorted.map((b) => blockSvg(b, id)).join("");

  // nhãn ghim: tháp, khối nhấn hoặc có label riêng (cây không gắn nhãn trừ khi nhấn); gộp nhãn trùng chữ
  const k = Math.max(1, vb[2]! / 640); // nhãn giữ kích thước đọc được khi cảnh lớn
  const groups = new Map<string, IsoBlock[]>();
  for (const b of blocks) {
    // nhãn: khối có "label" riêng, hoặc tháp (dùng key). Khối nhấn không có label thì không gắn để tránh lộ key kỹ thuật.
    if (!(b.label || b.kind === "tower")) continue;
    const text = b.label ?? b.key;
    const gk = text + "\u0000" + (b.showIn ?? []).join(" ");
    groups.set(gk, [...(groups.get(gk) ?? []), b]);
  }
  const labels = [...groups.entries()]
    .map(([gk, bs]) => {
      const text = gk.split("\u0000")[0]!;
      // đặt nhãn trên khối cao nhất của nhóm
      const b = bs.reduce((m, x) => ((x.z ?? 0) + x.floors > (m.z ?? 0) + m.floors ? x : m));
      const [lx, ly] = proj(b.x + b.w / 2, b.y + b.d / 2, (b.z ?? 0) + b.floors + 2);
      const wpx = Math.max(34, text.length * 6.6 + 14);
      const keys = bs.map((x) => x.key).join("|");
      const hot = bs.some((x) => x.highlight);
      const show = bs.every((x) => x.showIn) ? ` data-show="${esc([...new Set(bs.flatMap((x) => x.showIn!))].join(" "))}"` : "";
      return `<g class="iso-lbl${hot ? " hot" : ""}" data-key="${esc(keys)}"${show} transform="translate(${f1(lx)} ${f1(ly - 10 * k)}) scale(${f1(k)})">
<line y1="9" y2="${f1(16)}" stroke="#bbb"/><rect x="${f1(-wpx / 2)}" y="-10" width="${f1(wpx)}" height="19" rx="3"/><text y="3.5" text-anchor="middle">${esc(text)}</text></g>`;
    })
    .join("");

  const leg = legend
    ? `<div class="g-legend"><span><i class="sw normal"></i>${esc(legend.normal)}</span><span><i class="sw hot"></i>${esc(legend.highlight)}</span></div>`
    : "";
  return `${leg}<svg class="g-iso" viewBox="${vb.map(f1).join(" ")}" preserveAspectRatio="xMidYMid meet" role="img">
<defs>${patterns(id)}<radialGradient id="${id}-fade" cx=".5" cy=".55" r=".55"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="${id}-mask" maskContentUnits="userSpaceOnUse"><rect x="${f1(vb[0]!)}" y="${f1(vb[1]!)}" width="${f1(vb[2]!)}" height="${f1(vb[3]!)}" fill="url(#${id}-fade)"/></mask></defs>
<g class="iso-ground" mask="url(#${id}-mask)">${ground}</g>${shadows}${body}
${labels}</svg>`;
}
