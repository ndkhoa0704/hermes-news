import { config } from "./config";
import { join } from "node:path";
import { LATEST, VISUAL_DIR, runPipeline } from "./pipeline/run";
import homepage from "../web/index.html";
import storyPage from "../web/story.html";
import type { Digest } from "./shared/types";

const GEO_DIR = join(import.meta.dir, "..", "web", "geo");
const safeId = (s: string) => /^[A-Za-z0-9_-]{1,80}$/.test(s);

// Trạng thái pipeline (chỉ một lần chạy tại một thời điểm)
const state = {
  running: false,
  startedAt: null as string | null,
  lastFinishedAt: null as string | null,
  lastError: null as string | null,
  log: [] as string[],
};

async function refresh(reason: string) {
  if (state.running) return false;
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.lastError = null;
  state.log = [`[${reason}] bắt đầu lúc ${new Date().toLocaleTimeString("vi-VN")}`];
  const log = (m: string) => {
    console.log(m);
    state.log.push(m);
    if (state.log.length > 50) state.log.shift();
  };
  runPipeline({ log })
    .catch((e) => {
      state.lastError = (e as Error).message;
      log("✗ " + state.lastError);
    })
    .finally(() => {
      state.running = false;
      state.lastFinishedAt = new Date().toISOString();
    });
  return true;
}

// Lịch tự động cập nhật — Bun.cron chạy trong tiến trình, không chồng lấn lần chạy
const job = config.refreshCron ? Bun.cron(config.refreshCron, () => void refresh("cron"), { tz: config.tz }) : null;
process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));

const server = Bun.serve({
  port: config.port,
  hostname: config.hostname,
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
  routes: {
    "/": homepage,
    "/story/:id": storyPage,
    "/api/story/:id": async (req) => {
      const id = req.params.id;
      if (!safeId(id)) return new Response("Bad id", { status: 400 });
      const f = Bun.file(join(VISUAL_DIR, `${id}.json`));
      if (!(await f.exists())) return Response.json({ error: "Không có bài đồ họa" }, { status: 404 });
      return new Response(f, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" } });
    },
    // danh sách bài đồ họa của bản tin hiện tại (kèm hero để trang chủ vẽ thumbnail)
    "/api/visuals": async () => {
      const lf = Bun.file(LATEST);
      if (!(await lf.exists())) return Response.json([]);
      const d = (await lf.json()) as Digest;
      const out = [];
      for (const s of d.stories.filter((x) => x.hasVisual)) {
        const f = Bun.file(join(VISUAL_DIR, `${s.id}.json`));
        if (!(await f.exists())) continue;
        const v = await f.json();
        out.push({ storyId: s.id, kicker: v.kicker, title: v.title, dek: v.dek, hero: v.hero, heroState: v.heroState, category: s.category });
      }
      return Response.json(out, { headers: { "cache-control": "no-cache" } });
    },
    "/geo/:file": async (req) => {
      const name = req.params.file;
      if (!/^(world|sea)\.json$/.test(name)) return new Response("Not found", { status: 404 });
      return new Response(Bun.file(join(GEO_DIR, name)), { headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" } });
    },
    "/api/digest": async () => {
      const f = Bun.file(LATEST);
      if (!(await f.exists())) return Response.json({ error: "Chưa có bản tin, đang tạo…" }, { status: 404 });
      return new Response(f, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" } });
    },
    "/api/status": () =>
      Response.json({
        ...state,
        nextRun: config.refreshCron ? Bun.cron.parse(config.refreshCron, Date.now(), { tz: config.tz })?.toISOString() : null,
        cron: config.refreshCron || null,
        manualRefresh: config.manualRefresh,
      }),
    "/api/refresh": {
      POST: async () => {
        if (!config.manualRefresh) return Response.json({ error: "Cập nhật thủ công đã tắt" }, { status: 403 });
        const started = await refresh("manual");
        return Response.json({ started, running: state.running }, { status: started ? 202 : 409 });
      },
    },
    "/healthz": () => new Response("ok"),
  },
  fetch: () => new Response("Not found", { status: 404 }),
});

console.log(`📰 Hermes News chạy tại ${server.url}  (cron: ${config.refreshCron || "tắt"})`);
if (!(await Bun.file(LATEST).exists())) void refresh("startup");
void job;
