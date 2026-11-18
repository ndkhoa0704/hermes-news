import type { Article } from "../shared/types";
import { articleId, clean, fetchText, parseVnDateTime } from "./http";

// Znews (Zing News cũ) không còn RSS công khai -> đọc trang chủ bằng HTMLRewriter của Bun.
const PAGES = ["https://znews.vn/", "https://znews.vn/xa-hoi.html", "https://znews.vn/the-gioi.html", "https://znews.vn/kinh-doanh-tai-chinh.html"];

interface Draft {
  url?: string;
  title: string;
  image?: string;
  time: string;
  summary: string;
}

async function scrape(pageUrl: string): Promise<Article[]> {
  const html = await fetchText(pageUrl);
  const drafts: Draft[] = [];
  let cur: Draft | null = null;

  new HTMLRewriter()
    .on("article.article-item", {
      element() {
        cur = { title: "", time: "", summary: "" };
        drafts.push(cur);
      },
    })
    .on("article.article-item .article-title a", {
      element(el) {
        if (cur && !cur.url) cur.url = el.getAttribute("href") ?? undefined;
      },
      text(t) {
        if (cur) cur.title += t.text;
      },
    })
    .on("article.article-item .article-thumbnail img", {
      element(el) {
        if (cur && !cur.image) cur.image = el.getAttribute("data-src") ?? el.getAttribute("src") ?? undefined;
      },
    })
    .on("article.article-item time", {
      text(t) {
        if (cur) cur.time += t.text;
      },
    })
    .on("article.article-item .article-summary", {
      text(t) {
        if (cur) cur.summary += t.text;
      },
    })
    .transform(html);

  const section = pageUrl.match(/znews\.vn\/([a-z-]+)\.html/)?.[1];
  return drafts
    .filter((d) => d.url && clean(d.title))
    .map((d) => {
      const url = new URL(d.url!, "https://znews.vn/").href;
      return {
        id: articleId(url),
        source: "znews" as const,
        publisher: "Znews",
        title: clean(d.title),
        summary: clean(d.summary),
        url,
        image: d.image?.startsWith("data:") ? undefined : d.image,
        section,
        publishedAt: parseVnDateTime(d.time) ?? new Date().toISOString(),
      };
    });
}

export async function fetchZnews(): Promise<Article[]> {
  const results = await Promise.allSettled(PAGES.map(scrape));
  const out = new Map<string, Article>();
  for (const r of results) if (r.status === "fulfilled") for (const a of r.value) if (!out.has(a.id)) out.set(a.id, a);
  if (out.size === 0) {
    const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw err?.reason ?? new Error("Znews: không tìm thấy bài nào (có thể đã đổi HTML)");
  }
  return [...out.values()];
}
