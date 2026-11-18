#!/usr/bin/env bun
// Kiểm tra môi trường bằng Bun Shell: bun, hermes, mạng tới các báo.
import { $ } from "bun";
import { config } from "../src/config";

$.nothrow();
const ok = (b: boolean) => (b ? "✅" : "❌");

const bun = await $`bun --version`.quiet();
console.log(`${ok(bun.exitCode === 0)} bun ${bun.stdout.toString().trim()}`);

const hermes = await $`${config.hermesBin} --version`.quiet();
console.log(`${ok(hermes.exitCode === 0)} hermes: ${hermes.stdout.toString().split("\n")[0] || "không tìm thấy (đặt HERMES_BIN)"}`);

const hasTimeout = (await $`which timeout`.quiet()).exitCode === 0;
console.log(`${ok(hasTimeout)} coreutils timeout`);

for (const url of ["https://vnexpress.net/rss/thoi-su.rss", "https://znews.vn/", "https://baomoi.com/tin-moi.epi"]) {
  const t0 = performance.now();
  const res = await fetch(url, { headers: { "user-agent": config.userAgent }, signal: AbortSignal.timeout(15000) }).catch((e: Error) => e);
  const good = !(res instanceof Error) && res.ok;
  console.log(`${ok(good)} ${url} ${res instanceof Error ? res.message : res.status} (${Math.round(performance.now() - t0)}ms)`);
}

const latest = Bun.file(`${config.dataDir}/latest.json`);
if (await latest.exists()) {
  const d = await latest.json();
  console.log(`ℹ️  bản tin gần nhất: ${d.generatedAt} · ${d.stories.length} câu chuyện · editor=${d.editor}`);
} else console.log("ℹ️  chưa có bản tin — chạy: bun run pipeline");
