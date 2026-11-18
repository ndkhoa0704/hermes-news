import {
  CATEGORY_IDS,
  MOTIF_IDS,
  type ArtSpec,
  type Article,
  type Category,
  type Motif,
  type Story,
} from "../shared/types";
import { defaultArt } from "../shared/art-defaults";

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number, def: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const strArr = (v: unknown, maxItems: number, maxLen = 200) =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

function normArt(raw: unknown, category: Category, seed: string): ArtSpec {
  const base = defaultArt(category, seed);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const motif = MOTIF_IDS.includes(r.motif as Motif) ? (r.motif as Motif) : base.motif;
  const palette = strArr(r.palette, 5, 9).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  return {
    motif,
    palette: palette.length >= 2 ? palette : base.palette,
    energy: num(r.energy, 0, 1, base.energy),
    density: num(r.density, 0, 1, base.density),
    caption: str(r.caption, 300) || base.caption,
  };
}

/** Kiểm tra & làm sạch output của Hermes, nối với danh sách bài thật. */
export function normalizeStories(raw: unknown, articles: Article[]): { headline: string; overview: string; stories: Story[] } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const valid = new Set(articles.map((a) => a.id));
  const used = new Set<string>();
  const stories: Story[] = [];

  for (const [i, s] of (Array.isArray(obj.stories) ? obj.stories : []).entries()) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const title = str(r.title, 160);
    const articleIds = strArr(r.articleIds, 40, 20).filter((id) => valid.has(id));
    if (!title || articleIds.length === 0) continue;
    articleIds.forEach((id) => used.add(id));
    const category = CATEGORY_IDS.includes(r.category as Category) ? (r.category as Category) : "thoi-su";
    const id = `s${i + 1}-${articleIds[0]}`;
    stories.push({
      id,
      title,
      summary: str(r.summary, 1200),
      whyItMatters: str(r.whyItMatters, 600),
      keyPoints: strArr(r.keyPoints, 6, 300),
      category,
      tags: strArr(r.tags, 6, 40),
      location: str(r.location, 80) || undefined,
      sentiment: num(r.sentiment, -1, 1, 0),
      importance: Math.round(num(r.importance, 1, 5, 3)),
      articleIds,
      art: normArt(r.art, category, id),
      visualScore: Math.round(num(r.visualScore, 1, 5, 2)),
      visualAngle: str(r.visualAngle, 300) || undefined,
    });
  }
  stories.sort((a, b) => b.importance - a.importance || b.articleIds.length - a.articleIds.length);
  return { headline: str(obj.headline, 160), overview: str(obj.overview, 800), stories };
}
