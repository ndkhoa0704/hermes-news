import { $ } from "bun";
import { join } from "node:path";
import { config } from "../config";
import { fetchArticleText } from "../sources/fulltext";
import type { Article, Story } from "../shared/types";
import type { VisualStory } from "../shared/visual-types";
import { runHermes } from "./hermes";
import { normalizeVisual } from "./normalize-visual";
import { buildVisualPrompt, type SourceDoc } from "./visual-prompt";

/** Cổng 1: chỉ chọn câu chuyện Hermes đánh giá dựng được mô hình 3D (feasible, độ tin ≥ 3). Không đủ thì làm ít hơn hoặc không làm. */
export function pickVisualStories(stories: Story[], n = config.visualCount): Story[] {
  const score = (s: Story) => (s.model3d?.confidence ?? 0) * 2 + s.importance + s.articleIds.length * 0.3;
  return stories
    .filter((s) => s.model3d?.feasible && (s.model3d.confidence ?? 0) >= 3)
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

/** Bước 2 — ban Đồ họa: mỗi câu chuyện được chọn → một lượt Hermes dựng bài scrollytelling. */
export async function runVisualDesk(
  stories: Story[],
  articleMap: Map<string, Article>,
  runDir: string,
  log: (m: string) => void,
): Promise<VisualStory[]> {
  const results = await pool(stories, config.visualConcurrency, async (story) => {
    const dir = join(runDir, "visual", story.id);
    await $`mkdir -p ${dir}`;
    try {
      // toàn văn tối đa 3 bài/câu chuyện, ưu tiên VnExpress & Znews (toàn văn sạch hơn)
      const arts = story.articleIds
        .map((id) => articleMap.get(id))
        .filter(Boolean)
        .sort((a, b) => Number(b!.source !== "baomoi") - Number(a!.source !== "baomoi"))
        .slice(0, 3) as Article[];
      const docs: SourceDoc[] = await Promise.all(
        arts.map(async (article) => ({ article, text: await fetchArticleText(article.url).catch(() => "") })),
      );
      const outPath = join(dir, "visual.json");
      const promptPath = join(dir, "prompt.md");
      await Bun.write(promptPath, buildVisualPrompt(story, docs, outPath));
      const res = await runHermes(promptPath, outPath, dir);
      // Cổng 2: Hermes đọc toàn văn có thể từ chối nếu không đủ chi tiết hình khối
      const raw = res.raw as Record<string, unknown> | null;
      if (raw && raw.skip === true) {
        log(`   – bỏ qua "${story.title.slice(0, 50)}…": ${String(raw.reason ?? "không đủ dữ liệu dựng 3D").slice(0, 160)}`);
        return null;
      }
      // Cổng 3: bài phải thực sự có mô hình 3D (≥ 3 khối)
      const vs = normalizeVisual(res.raw, story.id, story.articleIds);
      if (!vs) throw new Error("JSON đồ họa không hợp lệ / không có mô hình 3D đủ chi tiết");
      log(`   ✓ đồ họa: ${vs.title} (${Math.round(res.ms / 1000)}s)`);
      return vs;
    } catch (e) {
      log(`   ✗ đồ họa "${story.title.slice(0, 50)}…": ${(e as Error).message}`);
      return null;
    }
  });
  return results.filter(Boolean) as VisualStory[];
}
