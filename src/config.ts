import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export const config = {
  root: ROOT,
  dataDir: join(ROOT, "data"),
  port: Number(process.env.PORT ?? 3130),
  hostname: process.env.HOST ?? "127.0.0.1",
  /** Lịch tự cập nhật (cron 5 trường, giờ địa phương). Rỗng = tắt. */
  refreshCron: process.env.REFRESH_CRON ?? "30 8 * * *",
  /** Múi giờ cho lịch cron. */
  tz: process.env.TZ_CRON ?? "Asia/Ho_Chi_Minh",
  /** Cho phép bấm "Cập nhật" từ web (POST /api/refresh). Tắt khi public để không ai đốt token Hermes. */
  manualRefresh: (process.env.ALLOW_MANUAL_REFRESH ?? "true") === "true",
  /** Lệnh Hermes CLI. */
  hermesBin: process.env.HERMES_BIN ?? "hermes",
  hermesModel: process.env.HERMES_MODEL ?? "claude-sonnet-5",
  hermesProvider: process.env.HERMES_PROVIDER ?? "anthropic",
  /** Số câu chuyện được dựng thành bài đồ họa kể chuyện mỗi lần chạy, và số lượt Hermes chạy song song. */
  visualCount: Number(process.env.VISUAL_COUNT ?? 5),
  visualConcurrency: Number(process.env.VISUAL_CONCURRENCY ?? 3),
  hermesTimeoutMs: Number(process.env.HERMES_TIMEOUT_MS ?? 15 * 60_000),
  /** Số bài tối đa gửi cho Hermes. */
  maxArticles: Number(process.env.MAX_ARTICLES ?? 140),
  /** Chỉ lấy bài trong N giờ gần nhất. */
  maxAgeHours: Number(process.env.MAX_AGE_HOURS ?? 24),
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};
