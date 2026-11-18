import { XML } from "bun";
import type { Article } from "../shared/types";
import { articleId, clean, fetchText } from "./http";

// VnExpress có RSS chính thức. Feed "tin-moi-nhat" đôi khi bị cache cũ nên lấy thêm các chuyên mục.
const FEEDS: Record<string, string> = {
  "tin-moi-nhat": "Tin mới",
  "thoi-su": "Thời sự",
  "the-gioi": "Thế giới",
  "kinh-doanh": "Kinh doanh",
  "so-hoa": "Số hóa",
  "the-thao": "Thể thao",
  "giai-tri": "Giải trí",
  "suc-khoe": "Sức khỏe",
  "khoa-hoc": "Khoa học",
  "phap-luat": "Pháp luật",
  "giao-duc": "Giáo dục",
};

type RssItem = { title?: string; link?: string; description?: string; pubDate?: string; enclosure?: { "@url"?: string } };

const text = (v: unknown): string =>
  typeof v === "string" ? v : v && typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : "";

export async function fetchVnExpress(): Promise<Article[]> {
  const results = await Promise.allSettled(
    Object.entries(FEEDS).map(async ([slug, section]) => {
      const xml = await fetchText(`https://vnexpress.net/rss/${slug}.rss`);
      const doc = XML.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
      const items = [doc.rss?.channel?.item ?? []].flat();
      return items.map((it): Article | null => {
        const url = text(it.link).trim();
        const title = clean(text(it.title));
        if (!url || !title) return null;
        const desc = text(it.description);
        const img = it.enclosure?.["@url"] ?? desc.match(/<img[^>]+src="([^"]+)"/)?.[1];
        const summary = clean(desc.split(/<\/br>|<br\s*\/?>/i).pop());
        const date = new Date(text(it.pubDate));
        return {
          id: articleId(url),
          source: "vnexpress",
          publisher: "VnExpress",
          title,
          summary,
          url,
          image: img,
          section: slug === "tin-moi-nhat" ? undefined : section,
          publishedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
        };
      });
    }),
  );
  const out = new Map<string, Article>();
  let firstError: unknown;
  for (const r of results) {
    if (r.status === "rejected") {
      firstError ??= r.reason;
      continue;
    }
    for (const a of r.value) {
      if (!a) continue;
      const prev = out.get(a.id);
      // Giữ bản có chuyên mục cụ thể
      if (!prev || (!prev.section && a.section)) out.set(a.id, a);
    }
  }
  if (out.size === 0 && firstError) throw firstError;
  return [...out.values()];
}
