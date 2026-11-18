import { config } from "./config";
import { LATEST, runPipeline } from "./pipeline/run";
import homepage from "../web/index.html";

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
