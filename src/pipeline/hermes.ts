import { $ } from "bun";
import { join } from "node:path";
import { config } from "../config";
import type { Article } from "../shared/types";
import { buildPrompt } from "./prompt";

export interface HermesResult {
  raw: unknown;
  ms: number;
  log: string;
}

/** Gọi Hermes Agent (CLI, chế độ one-shot) qua Bun Shell để biên tập bản tin. */
export async function runHermesEditor(articles: Article[], runDir: string): Promise<HermesResult> {
  const outPath = join(runDir, "hermes-output.json");
  const promptPath = join(runDir, "prompt.md");
  await Bun.write(promptPath, buildPrompt(articles, outPath));

  const modelArgs = config.hermesModel ? ["-m", config.hermesModel] : [];
  const timeoutSec = Math.round(config.hermesTimeoutMs / 1000);
  const t0 = performance.now();

  // Bun Shell: tự escape mọi biến nội suy (không lo injection), mảng được trải thành nhiều tham số.
  // `timeout` (coreutils) đảm bảo Hermes không treo pipeline mãi mãi.
  const res = await $`timeout ${timeoutSec} ${config.hermesBin} chat -Q --oneshot -t file --max-turns 12 ${modelArgs} --query-file ${promptPath}`
    .cwd(runDir)
    .env({ ...process.env, NO_COLOR: "1" })
    .quiet()
    .nothrow();

  const ms = Math.round(performance.now() - t0);
  const log = `exit=${res.exitCode} ms=${ms}\n--- stdout ---\n${res.stdout}\n--- stderr ---\n${res.stderr}`;
  await Bun.write(join(runDir, "hermes.log"), log);

  const file = Bun.file(outPath);
  if (await file.exists()) {
    try {
      return { raw: await file.json(), ms, log };
    } catch (e) {
      throw new Error(`Hermes ghi file nhưng JSON lỗi: ${(e as Error).message}`);
    }
  }
  // Dự phòng: model trả JSON thẳng ra stdout
  const out = res.stdout.toString();
  const m = out.match(/```(?:json)?\s*([\s\S]*?)```/) ?? out.match(/(\{[\s\S]*"stories"[\s\S]*\})/);
  if (m?.[1]) return { raw: JSON.parse(m[1]), ms, log };
  throw new Error(`Hermes không tạo output (exit ${res.exitCode}). Xem ${join(runDir, "hermes.log")}`);
}
