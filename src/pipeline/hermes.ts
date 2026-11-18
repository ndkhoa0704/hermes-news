import { $ } from "bun";
import { join } from "node:path";
import { config } from "../config";
import type { Article } from "../shared/types";
import { buildPrompt } from "./prompt";

export interface HermesResult {
  raw: unknown;
  ms: number;
}

/**
 * Chạy Hermes Agent một lượt (one-shot) qua Bun Shell, yêu cầu nó ghi JSON vào outPath.
 * - `-m/--provider`: ép model (mặc định Claude Sonnet 5)
 * - `--ignore-rules`: bỏ persona/memory cá nhân → văn phong báo chí trung lập
 * - `--source tool`: không làm rối danh sách phiên chat của người dùng
 * - `-t file`: chỉ cấp công cụ đọc/ghi file
 */
export async function runHermes(promptPath: string, outPath: string, cwd: string, logName = "hermes.log"): Promise<HermesResult> {
  const modelArgs = [
    ...(config.hermesModel ? ["-m", config.hermesModel] : []),
    ...(config.hermesProvider ? ["--provider", config.hermesProvider] : []),
  ];
  const timeoutSec = Math.round(config.hermesTimeoutMs / 1000);
  const t0 = performance.now();

  // Bun Shell tự escape mọi biến nội suy; mảng được trải thành nhiều tham số; `timeout` chặn treo vô hạn.
  const res = await $`timeout ${timeoutSec} ${config.hermesBin} chat -Q --oneshot -t file --max-turns 12 --ignore-rules --source tool ${modelArgs} --query-file ${promptPath}`
    .cwd(cwd)
    .env({ ...process.env, NO_COLOR: "1" })
    .quiet()
    .nothrow();

  const ms = Math.round(performance.now() - t0);
  await Bun.write(join(cwd, logName), `exit=${res.exitCode} ms=${ms}\n--- stdout ---\n${res.stdout}\n--- stderr ---\n${res.stderr}`);

  const file = Bun.file(outPath);
  if (await file.exists()) {
    try {
      return { raw: await file.json(), ms };
    } catch (e) {
      throw new Error(`Hermes ghi file nhưng JSON lỗi: ${(e as Error).message}`);
    }
  }
  const out = res.stdout.toString();
  const m = out.match(/```(?:json)?\s*([\s\S]*?)```/) ?? out.match(/(\{[\s\S]*\})/);
  if (m?.[1]) return { raw: JSON.parse(m[1]), ms };
  throw new Error(`Hermes không tạo output (exit ${res.exitCode}). Xem ${join(cwd, logName)}`);
}

/** Bước 1 — tổng biên tập: gom cụm & biên tập toàn bộ tin. */
export async function runHermesEditor(articles: Article[], runDir: string): Promise<HermesResult> {
  const outPath = join(runDir, "hermes-output.json");
  const promptPath = join(runDir, "prompt.md");
  await Bun.write(promptPath, buildPrompt(articles, outPath));
  return runHermes(promptPath, outPath, runDir, "hermes.log");
}
