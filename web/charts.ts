// Biểu đồ SVG thuần, không phụ thuộc thư viện.
export interface Datum {
  label: string;
  value: number;
  color: string;
  key?: string;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const f = (n: number) => n.toFixed(1);

export function donut(data: Datum[], centerLabel: string): string {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 70, r = 46, cx = 90, cy = 90;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d) => {
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)}`;
    const path = data.length === 1
      ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
      : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
    a0 = a1;
    return `<path d="${path}" fill="${d.color}" class="arc" data-filter="${esc(d.key ?? "")}" data-tip="${esc(d.label)}: ${d.value}"/>`;
  });
  const legend = data
    .map((d) => `<li data-filter="${esc(d.key ?? "")}"><i style="background:${d.color}"></i>${esc(d.label)}<b>${d.value}</b></li>`)
    .join("");
  return `<div class="donut"><svg viewBox="0 0 180 180">${arcs.join("")}<text x="90" y="86" class="donut-num">${total}</text><text x="90" y="106" class="donut-lbl">${esc(centerLabel)}</text></svg><ul class="legend">${legend}</ul></div>`;
}

export function hbars(data: Datum[]): string {
  const max = Math.max(1, ...data.map((d) => d.value));
  return `<div class="hbars">${data
    .map(
      (d) => `<div class="hbar" data-tip="${esc(d.label)}: ${d.value}"><span class="hbar-lbl">${esc(d.label)}</span><span class="hbar-track"><i style="width:${(d.value / max) * 100}%;background:${d.color}"></i></span><b>${d.value}</b></div>`,
    )
    .join("")}</div>`;
}

/** series: mỗi nguồn một mảng 24 giá trị (giờ cũ → mới). */
export function timeline(series: { label: string; color: string; values: number[] }[], hourLabels: string[]): string {
  const W = 720, H = 200, pl = 28, pb = 24, pt = 10;
  const n = hourLabels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => pl + (i / (n - 1)) * (W - pl - 8);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const v = Math.round((max * k) / 4);
    g += `<line x1="${pl}" x2="${W - 8}" y1="${f(y(v))}" y2="${f(y(v))}" class="gridline"/><text x="${pl - 6}" y="${f(y(v) + 4)}" class="axis" text-anchor="end">${v}</text>`;
  }
  hourLabels.forEach((h, i) => {
    if (i % 3 === 0 || i === n - 1) g += `<text x="${f(x(i))}" y="${H - 6}" class="axis" text-anchor="middle">${h}</text>`;
  });
  const paths = series
    .map((s, si) => {
      const pts = s.values.map((v, i) => `${f(x(i))},${f(y(v))}`);
      const id = `tl${si}`;
      return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
<path d="M ${pts[0]} L ${pts.join(" L ")} L ${f(x(n - 1))},${f(y(0))} L ${f(x(0))},${f(y(0))} Z" fill="url(#${id})"/>
<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
${s.values.map((v, i) => (v ? `<circle cx="${f(x(i))}" cy="${f(y(v))}" r="3.5" fill="${s.color}" data-tip="${esc(s.label)} · ${hourLabels[i]}h: ${v} bài"/>` : "")).join("")}`;
    })
    .join("");
  const legend = series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="timeline">${g}${paths}</svg><div class="inline-legend">${legend}</div>`;
}

export interface MoodPoint {
  id: string;
  title: string;
  sentiment: number;
  importance: number;
  size: number;
  color: string;
}

export function moodMap(points: MoodPoint[]): string {
  const W = 760, H = 300, pad = 34;
  const x = (s: number) => pad + ((s + 1) / 2) * (W - pad * 2);
  const y = (imp: number) => H - pad - ((imp - 1) / 4) * (H - pad * 2);
  // phân tán nhẹ để các điểm trùng nhau không chồng khít
  const seen = new Map<string, number>();
  const dots = points
    .map((p) => {
      const key = `${Math.round(p.sentiment * 5)}_${p.importance}`;
      const k = seen.get(key) ?? 0;
      seen.set(key, k + 1);
      const ang = k * 2.4;
      const off = k ? 14 + k * 3 : 0;
      const cx = x(p.sentiment) + Math.cos(ang) * off;
      const cy = y(p.importance) + Math.sin(ang) * off * 0.6;
      const r = 7 + Math.sqrt(p.size) * 4;
      return `<g class="dot" data-story="${esc(p.id)}" data-tip="${esc(p.title)}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${p.color}" fill-opacity=".75" stroke="${p.color}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r + 6)}" fill="none" stroke="${p.color}" stroke-opacity=".25" class="halo"/></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="mood">
<defs><linearGradient id="moodbg" x1="0" x2="1"><stop offset="0" stop-color="#ff6b6b" stop-opacity=".16"/><stop offset=".5" stop-color="#868e96" stop-opacity=".05"/><stop offset="1" stop-color="#51cf66" stop-opacity=".16"/></linearGradient></defs>
<rect x="${pad}" y="${pad / 2}" width="${W - pad * 2}" height="${H - pad * 1.5}" rx="14" fill="url(#moodbg)"/>
<line x1="${W / 2}" x2="${W / 2}" y1="${pad / 2}" y2="${H - pad}" class="gridline"/>
${[1, 2, 3, 4, 5].map((i) => `<line x1="${pad}" x2="${W - pad}" y1="${f(y(i))}" y2="${f(y(i))}" class="gridline"/><text x="${pad - 8}" y="${f(y(i) + 4)}" class="axis" text-anchor="end">${i}★</text>`).join("")}
<text x="${pad + 6}" y="${H - 10}" class="axis">😟 Tiêu cực</text><text x="${W / 2}" y="${H - 10}" class="axis" text-anchor="middle">Trung lập</text><text x="${W - pad - 6}" y="${H - 10}" class="axis" text-anchor="end">Tích cực 😊</text>
${dots}</svg>`;
}

/** Đám mây bong bóng từ khóa, đặt theo hình xoắn ốc tránh chồng lấp. */
export function bubbles(words: { text: string; value: number; color: string }[]): string {
  const W = 720, H = 260;
  const max = Math.max(1, ...words.map((w) => w.value));
  const placed: { x: number; y: number; r: number }[] = [];
  const out: string[] = [];
  for (const w of words) {
    const r = 16 + (w.value / max) * 34;
    let a = 0, x = W / 2, y = H / 2, ok = false;
    for (let step = 0; step < 900; step++) {
      const rad = step * 0.6;
      a += 0.35;
      x = W / 2 + Math.cos(a) * rad;
      y = H / 2 + Math.sin(a) * rad * 0.75;
      if (x - r < 0 || x + r > W || y - r < 0 || y + r > H) continue;
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 3)) { ok = true; break; }
    }
    if (!ok) continue;
    placed.push({ x, y, r });
    const fs = Math.max(9, Math.min(15, r / 2.6));
    const label = w.text.length > r / 3.6 ? w.text.slice(0, Math.max(3, Math.floor(r / 3.6))) + "…" : w.text;
    out.push(`<g class="bubble" data-search="${esc(w.text)}" data-tip="${esc(w.text)}: ${w.value}"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${w.color}" fill-opacity=".22" stroke="${w.color}" stroke-opacity=".7"/><text x="${f(x)}" y="${f(y + fs / 3)}" font-size="${f(fs)}" text-anchor="middle">${esc(label)}</text></g>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="bubbles">${out.join("")}</svg>`;
}
