import { $ } from "bun";
import { join } from "node:path";
import { config } from "../config";
import { collectArticles } from "../sources";
import type { Digest } from "../shared/types";
import { fallbackStories } from "./fallback";
import { runHermesEditor } from "./hermes";
import { normalizeStories } from "./normalize";

export const LATEST = join(config.dataDir, "latest.json");
const KEEP_RUNS = 24;

export interface RunOptions {
  /** Bỏ qua Hermes, dùng biên tập dự phòng (dùng để test nhanh). */
  skipHermes?: boolean;
  log?: (msg: string) => void;
}

export async function runPipeline(opts: RunOptions = {}): Promise<Digest> {
  const log = opts.log ?? console.log;
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = join(config.dataDir, "runs", runId);
  await $`mkdir -p ${runDir} ${join(config.dataDir, "history")}`;

  log("① Thu thập tin từ VnExpress, Znews, Báo Mới…");
  const { articles, bySource, errors, hourly } = await collectArticles();
  if (articles.length === 0) throw new Error("Không lấy được bài nào từ các nguồn: " + JSON.stringify(errors));
  await Bun.write(join(runDir, "articles.json"), JSON.stringify(articles, null, 2));
  log(`   → ${articles.length} bài sau khi lọc & khử trùng lặp`);

  let editor: Digest["editor"] = "hermes";
  let hermesMs: number | undefined;
  let edited: ReturnType<typeof normalizeStories> | undefined;

  if (!opts.skipHermes) {
    log("② Hermes đang đọc, gom cụm và biên tập (có thể mất vài phút)…");
    try {
      const res = await runHermesEditor(articles, runDir);
      hermesMs = res.ms;
      edited = normalizeStories(res.raw, articles);
      log(`   → Hermes trả về ${edited.stories.length} câu chuyện trong ${(res.ms / 1000).toFixed(0)}s`);
      if (edited.stories.length < 3) throw new Error("Hermes trả về quá ít câu chuyện hợp lệ");
    } catch (e) {
      log(`   ⚠ Hermes lỗi: ${(e as Error).message} → dùng biên tập dự phòng`);
      edited = undefined;
    }
  }
  if (!edited) {
    editor = "fallback";
    edited = fallbackStories(articles);
  }

  // Chỉ giữ các bài được tham chiếu + 60 bài mới nhất (cho timeline / danh sách tin nhanh)
  const referenced = new Set(edited.stories.flatMap((s) => s.articleIds));
  const keep = articles.filter((a, i) => referenced.has(a.id) || i < 60);

  const digest: Digest = {
    generatedAt: new Date().toISOString(),
    editor,
    headline: edited.headline || "Bản tin mới nhất",
    overview: edited.overview,
    stories: edited.stories,
    articles: keep,
    stats: { bySource, fetchErrors: errors, hermesMs, hourly },
  };

  const json = JSON.stringify(digest);
  await Bun.write(join(runDir, "digest.json"), json);
  await Bun.write(join(config.dataDir, "history", `${runId}.json`), json);
  await Bun.write(LATEST + ".tmp", json);
  await $`mv ${LATEST + ".tmp"} ${LATEST}`; // ghi nguyên tử

  // Dọn các lần chạy cũ
  const runs = (await $`ls ${join(config.dataDir, "runs")}`.text()).split("\n").filter(Boolean).sort();
  const old = runs.slice(0, Math.max(0, runs.length - KEEP_RUNS)).map((r) => join(config.dataDir, "runs", r));
  if (old.length) await $`rm -rf ${old}`;

  log(`③ Xong: ${digest.stories.length} câu chuyện (${editor}) → ${LATEST}`);
  return digest;
}

if (import.meta.main) {
  const skipHermes = process.argv.includes("--no-hermes");
  await runPipeline({ skipHermes });
}
