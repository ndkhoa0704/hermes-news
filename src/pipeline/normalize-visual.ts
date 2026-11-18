import type { Graphic, IsoBlock, VisualChapter, VisualStep, VisualStory } from "../shared/visual-types";

type R = Record<string, unknown>;
const isObj = (v: unknown): v is R => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown, max = 40) => arr(v).map((x) => str(x, 80)).filter(Boolean).slice(0, max);

function isoBlock(v: unknown): IsoBlock | null {
  if (!isObj(v)) return null;
  const key = str(v.key, 40);
  const floors = num(v.floors);
  if (!key || floors === null) return null;
  const kinds = ["tower", "house", "base", "box", "tree"] as const;
  const kind = kinds.includes(v.kind as never) ? (v.kind as IsoBlock["kind"]) : "box";
  const hf = arr(v.highlightFloors).map(num);
  return {
    key,
    label: str(v.label, 40) || undefined,
    kind,
    x: clamp(num(v.x) ?? 0, -10, 80),
    y: clamp(num(v.y) ?? 0, -10, 80),
    w: clamp(num(v.w) ?? 8, 0.5, 60),
    d: clamp(num(v.d) ?? 8, 0.5, 60),
    floors: clamp(floors, 0.2, 80),
    z: clamp(num(v.z) ?? 0, 0, 80),
    highlight: v.highlight === true,
    highlightFloors: hf.length === 2 && hf[0] !== null && hf[1] !== null ? [hf[0]!, hf[1]!] : undefined,
    showIn: strs(v.showIn, 6).length ? strs(v.showIn, 6) : undefined,
  };
}

export function normGraphic(v: unknown): Graphic | null {
  if (!isObj(v)) return null;
  const title = str(v.title, 140) || undefined;
  switch (v.type) {
    case "iso": {
      const blocks = arr(v.blocks).map(isoBlock).filter(Boolean) as IsoBlock[];
      if (!blocks.length) return null;
      const lg = isObj(v.legend) ? { normal: str(v.legend.normal, 40) || "Hiện trạng", highlight: str(v.legend.highlight, 40) || "Điểm nóng" } : undefined;
      return { type: "iso", title, legend: lg, blocks: blocks.slice(0, 80) };
    }
    case "compare": {
      const rows = arr(v.rows)
        .filter(isObj)
        .map((r) => ({ key: str(r.key, 60), left: num(r.left), right: num(r.right), unit: str(r.unit, 20) || undefined }))
        .filter((r) => r.key && r.left !== null && r.right !== null) as { key: string; left: number; right: number; unit?: string }[];
      if (!rows.length) return null;
      return { type: "compare", title, leftLabel: str(v.leftLabel, 40) || "Trước", rightLabel: str(v.rightLabel, 40) || "Sau", rows: rows.slice(0, 10), note: str(v.note, 160) || undefined };
    }
    case "units": {
      const groups = arr(v.groups)
        .filter(isObj)
        .map((g) => ({ key: str(g.key, 60), value: num(g.value), highlight: g.highlight === true, showIn: strs(g.showIn, 6).length ? strs(g.showIn, 6) : undefined }))
        .filter((g) => g.key && g.value !== null && g.value! >= 0) as { key: string; value: number; highlight?: boolean; showIn?: string[] }[];
      if (!groups.length) return null;
      const total = groups.reduce((s, g) => s + g.value, 0);
      let perDot = num(v.perDot) ?? 1;
      // giữ số chấm trong khoảng hợp lý (≤ 600)
      if (total / perDot > 600) perDot = Math.ceil(total / 600);
      if (perDot < 1) perDot = 1;
      return { type: "units", title, unit: str(v.unit, 20) || "", perDot, groups: groups.slice(0, 6) };
    }
    case "bignumber": {
      const value = str(v.value, 24);
      if (!value) return null;
      return { type: "bignumber", value, label: str(v.label, 120), sub: str(v.sub, 160) || undefined };
    }
    case "timeline": {
      const events = arr(v.events)
        .filter(isObj)
        .map((e, i) => ({ key: str(e.key, 40) || str(e.date, 40) || String(i), date: str(e.date, 40), title: str(e.title, 140), text: str(e.text, 300) || undefined, highlight: e.highlight === true }))
        .filter((e) => e.date && e.title);
      if (events.length < 2) return null;
      return { type: "timeline", title, events: events.slice(0, 14) };
    }
    case "map": {
      const points = arr(v.points)
        .filter(isObj)
        .map((p) => ({ key: str(p.key, 50), lat: num(p.lat), lon: num(p.lon), value: num(p.value) ?? undefined, note: str(p.note, 200) || undefined, highlight: p.highlight === true }))
        .filter((p) => p.key && p.lat !== null && p.lon !== null && Math.abs(p.lat!) <= 90 && Math.abs(p.lon!) <= 180) as {
        key: string;
        lat: number;
        lon: number;
        value?: number;
        note?: string;
        highlight?: boolean;
      }[];
      if (!points.length) return null;
      let scope = (["vietnam", "world", "local"] as const).includes(v.scope as never) ? (v.scope as "vietnam" | "world" | "local") : "vietnam";
      // sửa scope theo toạ độ thật: "local" chỉ khi các điểm gần nhau; ngoài lãnh thổ VN → world
      const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
      const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
      const inVN = points.every((p) => p.lat >= 7 && p.lat <= 24 && p.lon >= 101 && p.lon <= 118);
      if (scope === "local" && (span > 0.6 || !inVN)) scope = inVN ? "vietnam" : "world";
      if (scope === "vietnam" && !inVN) scope = "world";
      return { type: "map", title, scope, points: points.slice(0, 30) };
    }
    case "flow": {
      const steps = arr(v.steps)
        .filter(isObj)
        .map((s, i) => ({ key: str(s.key, 40) || str(s.label, 40) || String(i), label: str(s.label, 80), text: str(s.text, 240) || undefined, highlight: s.highlight === true }))
        .filter((s) => s.label);
      if (steps.length < 2) return null;
      return { type: "flow", title, steps: steps.slice(0, 8) };
    }
    case "actors": {
      const nodes = arr(v.nodes)
        .filter(isObj)
        .map((n) => ({ key: str(n.key, 60), role: str(n.role, 100), group: str(n.group, 40) || undefined }))
        .filter((n) => n.key);
      if (nodes.length < 2) return null;
      const keys = new Set(nodes.map((n) => n.key));
      const links = arr(v.links)
        .filter(isObj)
        .map((l) => ({ from: str(l.from, 60), to: str(l.to, 60), label: str(l.label, 60) || undefined }))
        .filter((l) => keys.has(l.from) && keys.has(l.to));
      return { type: "actors", title, nodes: nodes.slice(0, 12), links: links.slice(0, 20) };
    }
    case "bars": {
      const items = arr(v.items)
        .filter(isObj)
        .map((it) => ({ key: str(it.key, 60), value: num(it.value), highlight: it.highlight === true }))
        .filter((it) => it.key && it.value !== null) as { key: string; value: number; highlight?: boolean }[];
      if (items.length < 2) return null;
      return { type: "bars", title, unit: str(v.unit, 20) || undefined, items: items.slice(0, 14) };
    }
    case "quote": {
      const text = str(v.text, 400);
      return text ? { type: "quote", text, who: str(v.who, 100) } : null;
    }
  }
  return null;
}

function normStep(v: unknown): VisualStep | null {
  if (typeof v === "string") return v.trim() ? { text: v.trim().slice(0, 900) } : null;
  if (!isObj(v)) return null;
  const text = str(v.text, 900);
  if (!text) return null;
  return { text, focus: strs(v.focus, 12).length ? strs(v.focus, 12) : undefined, state: str(v.state, 40) || undefined };
}

export function normalizeVisual(raw: unknown, storyId: string, articleIds: string[]): VisualStory | null {
  if (!isObj(raw)) return null;
  const hero = normGraphic(raw.hero);
  const chapters: VisualChapter[] = arr(raw.chapters)
    .filter(isObj)
    .map((c) => ({
      heading: str(c.heading, 140) || undefined,
      graphic: normGraphic(c.graphic) ?? undefined,
      steps: arr(c.steps).map(normStep).filter(Boolean) as VisualStep[],
    }))
    .filter((c) => c.steps.length)
    .slice(0, 7);
  const title = str(raw.title, 160);
  if (!title || !hero || chapters.length < 2) return null;
  return {
    storyId,
    kicker: str(raw.kicker, 60) || "Đồ họa",
    title,
    dek: str(raw.dek, 500),
    hero,
    heroState: str(raw.heroState, 40) || undefined,
    heroCaption: str(raw.heroCaption, 300) || undefined,
    stateLabels: isObj(raw.stateLabels)
      ? Object.fromEntries(Object.entries(raw.stateLabels).map(([k, v]) => [k.slice(0, 40), str(v, 40)]).filter(([, v]) => v))
      : undefined,
    chapters,
    factbox: arr(raw.factbox)
      .filter(isObj)
      .map((f) => ({ label: str(f.label, 80), value: str(f.value, 80) }))
      .filter((f) => f.label && f.value)
      .slice(0, 8),
    dataNotes: strs(raw.dataNotes, 6).map((s) => s.slice(0, 300)),
    articleIds,
    generatedAt: new Date().toISOString(),
  };
}
