# Hermes News — ghi chú cho agent

- Runtime: Bun (TypeScript, không build bước riêng). `~/.bun/bin/bun`.
- Pipeline: `src/sources/*` (fetch + Bun.XML / HTMLRewriter) → `src/pipeline/hermes.ts` (gọi `hermes chat -Q --oneshot -t file --query-file …` qua Bun Shell) → `normalize.ts` → `data/latest.json`.
- Không dùng cờ `--source` của `hermes chat` (gây lỗi `invalid_params`).
- Frontend: `web/` được Bun.serve bundle qua HTML import; ảnh trừu tượng vẽ bằng `src/shared/art.ts` (SVG, seed theo story id).
- Kiểm tra: `bun check`, `bun run doctor`, `bun run pipeline -- --no-hermes` (nhanh, không gọi AI).
