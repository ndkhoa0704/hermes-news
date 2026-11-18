import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export const config = {
  root: ROOT,
  dataDir: join(ROOT, "data"),
  port: Number(process.env.PORT ?? 3130),
  hostname: process.env.HOST ?? "127.0.0.1",
  /** Lịch tự cập nhật (cron 5 trường, giờ địa phương). Rỗng = tắt. */
  refreshCron: process.env.REFRESH_CRON ?? "0 */2 * * *",
  /** Lệnh Hermes CLI. */
  hermesBin: process.env.HERMES_BIN ?? "hermes",
  hermesModel: process.env.HERMES_MODEL ?? "", // rỗng = model mặc định của Hermes
  hermesTimeoutMs: Number(process.env.HERMES_TIMEOUT_MS ?? 15 * 60_000),
  /** Số bài tối đa gửi cho Hermes. */
  maxArticles: Number(process.env.MAX_ARTICLES ?? 140),
  /** Chỉ lấy bài trong N giờ gần nhất. */
  maxAgeHours: Number(process.env.MAX_AGE_HOURS ?? 24),
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};
