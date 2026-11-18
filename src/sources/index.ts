import { config } from "../config";
import type { Article, SourceId } from "../shared/types";
import { fetchBaomoi } from "./baomoi";
import { fetchVnExpress } from "./vnexpress";
import { fetchZnews } from "./znews";

const FETCHERS: Record<SourceId, () => Promise<Article[]>> = {
  vnexpress: fetchVnExpress,
  znews: fetchZnews,
  baomoi: fetchBaomoi,
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

export interface CollectResult {
  articles: Article[];
  bySource: Record<string, number>;
  errors: Record<string, string>;
  /** Số bài đăng mỗi giờ trong 24h qua theo nguồn (tính trên toàn bộ bài thu được, trước khi cắt). */
  hourly: { start: string; series: Record<string, number[]> };
}

/** Lấy tin từ mọi nguồn song song, lọc theo thời gian, khử trùng lặp và cân bằng giữa các nguồn. */
export async function collectArticles(): Promise<CollectResult> {
  const errors: Record<string, string> = {};
  const perSource = new Map<SourceId, Article[]>();

  await Promise.all(
    (Object.keys(FETCHERS) as SourceId[]).map(async (src) => {
      const t0 = performance.now();
      try {
        const list = await FETCHERS[src]();
        perSource.set(src, list);
        console.log(`  ✓ ${src}: ${list.length} bài (${Math.round(performance.now() - t0)}ms)`);
      } catch (e) {
        errors[src] = e instanceof Error ? e.message : String(e);
        console.warn(`  ✗ ${src}: ${errors[src]}`);
      }
    }),
  );

  const cutoff = Date.now() - config.maxAgeHours * 3600_000;
  const seenTitles = new Set<string>();
  const queues: Article[][] = [];
  for (const [, list] of perSource) {
    queues.push(
      list
        .filter((a) => Date.parse(a.publishedAt) >= cutoff)
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
    );
  }

  // Round-robin để mỗi nguồn có tỉ lệ công bằng trong giới hạn maxArticles
  const picked: Article[] = [];
  while (picked.length < config.maxArticles && queues.some((q) => q.length)) {
    for (const q of queues) {
      const a = q.shift();
      if (!a) continue;
      const key = norm(a.title);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      picked.push(a);
      if (picked.length >= config.maxArticles) break;
    }
  }

  picked.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  const start = hourStart.getTime() - 23 * 3600_000;
  const series: Record<string, number[]> = {};
  for (const [src, list] of perSource) {
    const arr = (series[src] = new Array<number>(24).fill(0));
    const seen = new Set<string>();
    for (const a of list) {
      const idx = Math.floor((Date.parse(a.publishedAt) - start) / 3600_000);
      if (idx < 0 || idx > 23 || seen.has(a.id)) continue;
      seen.add(a.id);
      arr[idx]!++;
    }
  }
  const bySource: Record<string, number> = {};
  for (const a of picked) bySource[a.source] = (bySource[a.source] ?? 0) + 1;
  return { articles: picked, bySource, errors, hourly: { start: new Date(start).toISOString(), series } };
}
