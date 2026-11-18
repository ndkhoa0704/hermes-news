import { clean, fetchText } from "./http";

// Lấy toàn văn bài báo (để Hermes có đủ số liệu dựng đồ họa).
const SELECTORS: [RegExp, string[]][] = [
  [/vnexpress\.net/, ["article.fck_detail p", ".fck_detail p.Normal", ".sidebar-1 .description"]],
  [/znews\.vn|zingnews\.vn/, [".the-article-body p", ".the-article-summary"]],
  [/baomoi\.com/, ["div.content-body p", "h3.sapo, .sapo"]],
];

export async function fetchArticleText(url: string, maxChars = 7000): Promise<string> {
  const html = await fetchText(url, 15_000);
  const sels = SELECTORS.find(([re]) => re.test(url))?.[1] ?? ["article p", "main p"];
  const parts: string[] = [];
  let buf = "";
  let owner = -1; // chỉ selector đầu tiên khớp phần tử mới được gom chữ (tránh nhân đôi)
  let rw = new HTMLRewriter();
  sels.forEach((sel, idx) => {
    rw = rw.on(sel, {
      element(el) {
        if (owner !== -1) return;
        owner = idx;
        buf = "";
        el.onEndTag(() => {
          if (buf) parts.push(buf);
          buf = "";
          owner = -1;
        });
      },
      text(t) {
        if (owner === idx) buf += t.text;
      },
    });
  });
  rw.transform(html);
  if (buf) parts.push(buf);
  const seen = new Set<string>();
  const out = parts
    .map((p) => clean(p))
    .filter((p) => p.length > 25 && !seen.has(p) && (seen.add(p), true));
  return out.join("\n").slice(0, maxChars);
}
