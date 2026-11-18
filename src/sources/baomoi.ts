import type { Article } from "../shared/types";
import { articleId, clean, fetchText } from "./http";

// Báo Mới là Next.js app: dữ liệu nằm trong <script id="__NEXT_DATA__">.
const PAGES = ["https://baomoi.com/tin-moi.epi", "https://baomoi.com/"];

interface BmItem {
  title?: string;
  date?: number;
  url?: string;
  thumb?: string;
  description?: string;
  publisher?: { name?: string };
}

function findItems(node: unknown, acc: BmItem[] = []): BmItem[] {
  if (Array.isArray(node)) {
    if (node.length && node.every((x) => x && typeof x === "object" && "title" in x && "url" in x && "date" in x)) {
      acc.push(...(node as BmItem[]));
      return acc;
    }
    for (const x of node) findItems(x, acc);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) findItems(v, acc);
  }
  return acc;
}

async function scrape(pageUrl: string): Promise<Article[]> {
  const html = await fetchText(pageUrl);
  let json = "";
  new HTMLRewriter()
    .on("script#__NEXT_DATA__", {
      text(t) {
        json += t.text;
      },
    })
    .transform(html);
  if (!json) throw new Error("Báo Mới: không thấy __NEXT_DATA__");
  const items = findItems(JSON.parse(json));
  return items
    .filter((it) => it.title && it.url && it.date)
    .map((it) => {
      const url = new URL(it.url!.replace(/#.*$/, ""), "https://baomoi.com/").href;
      return {
        id: articleId(url),
        source: "baomoi" as const,
        publisher: it.publisher?.name ? `${it.publisher.name} (Báo Mới)` : "Báo Mới",
        title: clean(it.title),
        summary: clean(it.description),
        url,
        image: it.thumb,
        publishedAt: new Date(it.date! * 1000).toISOString(),
      };
    });
}

export async function fetchBaomoi(): Promise<Article[]> {
  const results = await Promise.allSettled(PAGES.map(scrape));
  const out = new Map<string, Article>();
  for (const r of results) if (r.status === "fulfilled") for (const a of r.value) if (!out.has(a.id)) out.set(a.id, a);
  if (out.size === 0) throw (results.find((r) => r.status === "rejected") as PromiseRejectedResult)?.reason;
  return [...out.values()];
}
