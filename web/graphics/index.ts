import type { Graphic, VisualStep } from "../../src/shared/visual-types";
import { renderIso } from "./iso";
import { renderMap } from "./map";
import { esc, f1, fmt } from "./util";

let seq = 0;

/** Render một đồ họa vào phần tử (một số loại, như map, tải dữ liệu bất đồng bộ). */
export function mountGraphic(el: HTMLElement, g: Graphic, initialState?: string) {
  const id = "g" + ++seq;
  el.dataset.type = g.type;
  const title = "title" in g && g.title ? `<h4 class="g-title">${esc(g.title)}</h4>` : "";
  switch (g.type) {
    case "iso":
      el.innerHTML = title + renderIso(g.blocks, id, g.legend);
      break;
    case "compare": {
      el.innerHTML = `${title}<div class="g-compare">
<div class="cmp-head"><span><i class="sw cold"></i>${esc(g.leftLabel)}</span><span><i class="sw hot"></i>${esc(g.rightLabel)}</span></div>
${g.rows
  .map((r) => {
    const max = Math.max(r.left, r.right, 1e-9);
    const ratio = r.left > 0 ? r.right / r.left : null;
    const badge = ratio === null ? "" : ratio >= 1.95 ? `×${fmt(Math.round(ratio * 10) / 10)}` : `${ratio >= 1 ? "+" : ""}${fmt(Math.round((ratio - 1) * 100))}%`;
    return `<div class="cmp-row" data-key="${esc(r.key)}"><div class="cmp-lbl">${esc(r.key)}${badge ? `<b class="cmp-badge">${badge}</b>` : ""}</div>
<div class="cmp-bar"><i class="cold" style="--w:${f1((r.left / max) * 100)}%"></i><span>${fmt(r.left)} ${esc(r.unit ?? "")}</span></div>
<div class="cmp-bar"><i class="hot" style="--w:${f1((r.right / max) * 100)}%"></i><span>${fmt(r.right)} ${esc(r.unit ?? "")}</span></div></div>`;
  })
  .join("")}
${g.note ? `<p class="g-note">${esc(g.note)}</p>` : ""}</div>`;
      break;
    }
    case "units": {
      const per = g.perDot ?? 1;
      const dots: string[] = [];
      let i = 0;
      g.groups.forEach((gr, gi) => {
        const n = Math.max(gr.value > 0 ? 1 : 0, Math.round(gr.value / per));
        for (let k = 0; k < n; k++)
          dots.push(`<i class="u g${gi}${gr.highlight ? " hot" : ""}" data-key="${esc(gr.key)}"${gr.showIn ? ` data-show="${esc(gr.showIn.join(" "))}"` : ""} style="--d:${(i++ % 300) * 4}ms"></i>`);
      });
      el.innerHTML = `${title}<div class="g-units"><div class="u-grid" style="--cols:${Math.min(40, Math.max(12, Math.ceil(Math.sqrt(dots.length * 2))))}">${dots.join("")}</div>
<div class="u-legend">${g.groups
        .map((gr, gi) => `<span data-key="${esc(gr.key)}"${gr.showIn ? ` data-show="${esc(gr.showIn.join(" "))}"` : ""}><i class="u g${gi}${gr.highlight ? " hot" : ""}"></i>${esc(gr.key)}: <b>${fmt(gr.value)}</b> ${esc(g.unit)}</span>`)
        .join("")}</div>
<p class="g-note">Mỗi ô = ${fmt(per)} ${esc(g.unit)}</p></div>`;
      break;
    }
    case "bignumber":
      el.innerHTML = `<div class="g-big"><div class="big-val" style="--k:${Math.min(1, 7 / Math.max(4, g.value.length)).toFixed(2)}" data-count="${esc(g.value)}">${esc(g.value)}</div><div class="big-lbl">${esc(g.label)}</div>${g.sub ? `<div class="big-sub">${esc(g.sub)}</div>` : ""}</div>`;
      break;
    case "timeline":
      el.innerHTML = `${title}<ol class="g-timeline">${g.events
        .map((e) => `<li class="${e.highlight ? "hot" : ""}" data-key="${esc(e.key)}"><time>${esc(e.date)}</time><b>${esc(e.title)}</b>${e.text ? `<p>${esc(e.text)}</p>` : ""}</li>`)
        .join("")}</ol>`;
      break;
    case "map":
      el.innerHTML = `${title}<div class="g-mapbox"><div class="map-loading">Đang tải bản đồ…</div></div>`;
      void renderMap(el.querySelector(".g-mapbox")!, g.scope, g.points).then(() => applyStep(el, { text: "", focus: el.dataset.focus ? JSON.parse(el.dataset.focus) : undefined }));
      break;
    case "flow":
      el.innerHTML = `${title}<ol class="g-flow">${g.steps
        .map((s, i) => `<li class="${s.highlight ? "hot" : ""}" data-key="${esc(s.key)}"><span class="fl-n">${i + 1}</span><div><b>${esc(s.label)}</b>${s.text ? `<p>${esc(s.text)}</p>` : ""}</div></li>`)
        .join("")}</ol>`;
      break;
    case "actors": {
      const W = 640, H = 460, cx = W / 2, cy = H / 2;
      const groups = [...new Set(g.nodes.map((n) => n.group ?? ""))];
      const pos = new Map<string, [number, number]>();
      g.nodes.forEach((n, i) => {
        const a = (i / g.nodes.length) * Math.PI * 2 - Math.PI / 2;
        pos.set(n.key, [cx + Math.cos(a) * 220, cy + Math.sin(a) * 170]);
      });
      const links = g.links
        .map((l) => {
          const [x1, y1] = pos.get(l.from)!;
          const [x2, y2] = pos.get(l.to)!;
          const mx = (x1 + x2) / 2 + (cy - (y1 + y2) / 2) * 0.2;
          const my = (y1 + y2) / 2 + ((x1 + x2) / 2 - cx) * 0.2;
          return `<g class="ac-link" data-key="${esc(l.from)}|${esc(l.to)}"><path d="M${f1(x1)},${f1(y1)} Q${f1(mx)},${f1(my)} ${f1(x2)},${f1(y2)}" marker-end="url(#${id}-arr)"/>${l.label ? `<text x="${f1(mx)}" y="${f1(my)}" text-anchor="middle">${esc(l.label)}</text>` : ""}</g>`;
        })
        .join("");
      const nodes = g.nodes
        .map((n) => {
          const [x, y] = pos.get(n.key)!;
          const gi = groups.indexOf(n.group ?? "");
          return `<g class="ac-node gr${gi % 4}" data-key="${esc(n.key)}" transform="translate(${f1(x)} ${f1(y)})"><circle r="26"/><text class="nm" y="44" text-anchor="middle">${esc(n.key)}</text><text class="rl" y="60" text-anchor="middle">${esc(n.role.slice(0, 42))}</text><text class="ini" y="6" text-anchor="middle">${esc(n.key.split(/\s+/).slice(-1)[0]!.slice(0, 2).toUpperCase())}</text></g>`;
        })
        .join("");
      el.innerHTML = `${title}<svg class="g-actors" viewBox="-60 -10 ${W + 120} ${H + 60}"><defs><marker id="${id}-arr" viewBox="0 0 10 10" refX="34" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9b948a"/></marker></defs>${links}${nodes}</svg>
${groups.filter(Boolean).length > 1 ? `<div class="g-legend inline">${groups.map((gname, gi) => (gname ? `<span><i class="sw gr${gi % 4}"></i>${esc(gname)}</span>` : "")).join("")}</div>` : ""}`;
      break;
    }
    case "bars": {
      const max = Math.max(...g.items.map((i) => i.value), 1e-9);
      el.innerHTML = `${title}<div class="g-bars">${g.items
        .map((it) => `<div class="br-row${it.highlight ? " hot" : ""}" data-key="${esc(it.key)}"><span class="br-lbl">${esc(it.key)}</span><span class="br-track"><i style="--w:${f1((it.value / max) * 100)}%"></i></span><b>${fmt(it.value)}${g.unit ? ` ${esc(g.unit)}` : ""}</b></div>`)
        .join("")}</div>`;
      break;
    }
    case "quote":
      el.innerHTML = `<figure class="g-quote"><blockquote>${esc(g.text)}</blockquote><figcaption>— ${esc(g.who)}</figcaption></figure>`;
      break;
  }
  applyStep(el, { text: "", state: initialState });
}

/** Áp dụng trạng thái của một bước cuộn: state (ẩn/hiện) + focus (làm nổi). */
export function applyStep(el: HTMLElement, step: Pick<VisualStep, "focus" | "state"> & { text?: string }) {
  const state = step.state ?? el.dataset.state ?? defaultState(el);
  if (state) el.dataset.state = state;
  el.querySelectorAll<SVGElement | HTMLElement>("[data-show]").forEach((n) => {
    n.classList.toggle("is-hidden", !!state && !n.dataset.show!.split(" ").includes(state));
  });
  const focus = step.focus?.filter(Boolean) ?? [];
  el.dataset.focus = JSON.stringify(focus);
  el.classList.toggle("has-focus", focus.length > 0);
  el.querySelectorAll<SVGElement | HTMLElement>("[data-key]").forEach((n) => {
    const keys = n.dataset.key!.split("|");
    const on = focus.some((f) => keys.includes(f));
    n.classList.toggle("is-on", on);
  });
}

function defaultState(el: HTMLElement): string | undefined {
  const first = el.querySelector<HTMLElement>("[data-show]");
  return first?.dataset.show?.split(" ")[0];
}

/** Hiệu ứng đếm số cho bignumber. */
export function countUp(el: HTMLElement) {
  el.querySelectorAll<HTMLElement>(".big-val[data-count]").forEach((n) => {
    const raw = n.dataset.count!;
    const m = raw.match(/^([^\d]*)([\d.,]+)(.*)$/);
    if (!m || n.dataset.done) return;
    n.dataset.done = "1";
    const target = Number(m[2]!.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(target)) return;
    const decimals = m[2]!.includes(",") ? m[2]!.split(",")[1]!.length : 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400);
      const v = target * (1 - Math.pow(1 - p, 3));
      n.textContent = m[1] + v.toLocaleString("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + m[3];
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
