# Hermes News — ghi chú cho agent

- Runtime: Bun (TypeScript, không build bước riêng). `~/.bun/bin/bun`.
- Pipeline: `src/sources/*` (fetch + Bun.XML / HTMLRewriter) → `src/pipeline/hermes.ts` (gọi `hermes chat -Q --oneshot -t file --query-file …` qua Bun Shell) → `normalize.ts` → `data/latest.json`.
- Không dùng cờ `--source` của `hermes chat` (gây lỗi `invalid_params`).
- Frontend: `web/` được Bun.serve bundle qua HTML import; ảnh trừu tượng vẽ bằng `src/shared/art.ts` (SVG, seed theo story id).
- Kiểm tra: `bun check`, `bun run doctor`, `bun run pipeline -- --no-hermes` (nhanh, không gọi AI).
- Hermes chạy với `-m claude-sonnet-5 --provider anthropic --ignore-rules --source tool` (bỏ persona/memory cá nhân, không làm rối danh sách phiên).
- Ban Đồ họa: `src/pipeline/visual*.ts` + prompt `visual-prompt.ts`; schema `src/shared/visual-types.ts`; renderer `web/graphics/*` (iso.ts = mô hình 3D isometric SVG).
- Headless browser của Hermes treo khi trang có `scroll-behavior: smooth` → khi kiểm thử dùng `scrollTo({behavior:'instant'})`.
- Dữ liệu bản đồ: `bun scripts/build-geo.ts countries-110m.json countries-50m.json` (world-atlas) → `web/geo/`.
