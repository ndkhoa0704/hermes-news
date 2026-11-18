# 📰 Hermes News

Hệ thống tự động **lấy tin mới nhất từ VnExpress, Znews (Zing News) và Báo Mới**, để **Hermes Agent** đọc – gom cụm – biên tập
thành các "câu chuyện", rồi hiển thị trên một trang web responsive có **kéo thả, biểu đồ trực quan** và **ảnh minh họa trừu tượng**
cho từng sự kiện.

```
 VnExpress RSS ─┐   Bun.XML.parse
 Znews HTML  ───┼─▶ HTMLRewriter ─▶ khử trùng lặp, cân bằng nguồn (≤140 bài/24h)
 Báo Mới JSON ──┘                         │
                                          ▼
                     Bun Shell: hermes chat -Q --oneshot -t file --query-file prompt.md
                     (Hermes gom cụm, viết tóm tắt, chấm cảm xúc/mức quan trọng,
                      chọn mô-típ + bảng màu cho ảnh trừu tượng, ghi JSON)
                                          │
                                          ▼
                      normalize + validate ─▶ data/latest.json (+ history)
                                          │
                                          ▼
              Bun.serve (HTML import, API, Bun.cron tự cập nhật) ─▶ trình duyệt
```

## Tính năng giao diện
- **Ảnh trừu tượng sinh theo sự kiện**: Hermes chọn 1 trong 13 mô-típ (sóng, tăng trưởng, sụt giảm, mạng lưới, quỹ đạo, mảnh vỡ,
  nở hoa, đô thị, nhịp đập, xoắn ốc, gợn sóng, hạt, núi), bảng màu theo cảm xúc, độ dữ dội/mật độ, kèm câu mô tả ẩn dụ.
  `src/shared/art.ts` vẽ thành SVG (seed theo id → ổn định, mỗi tin một hình).
- **Kéo thả** (SortableJS, hỗ trợ cảm ứng): sắp xếp lại lưới câu chuyện, kéo thẻ sang **📌 Theo dõi** để ghim, đổi vị trí các biểu đồ.
  Mọi thứ lưu trong `localStorage`.
- **Trực quan hóa**: bản đồ cảm xúc (tiêu cực ↔ tích cực × mức quan trọng), donut chủ đề, nguồn báo, nhịp đăng tin 24h,
  bong bóng từ khóa, địa điểm. Bấm vào biểu đồ để lọc/mở tin.
- Tìm kiếm (`/`), lọc chủ đề, nhiều kiểu sắp xếp, chế độ sáng/tối, modal chi tiết (ý chính, vì sao đáng quan tâm, nguồn gốc),
  chia sẻ link `#story-id`, nút **Cập nhật** chạy lại pipeline và hiển thị tiến trình trực tiếp.

## Chạy
```bash
bun install
bun run doctor            # kiểm tra bun/hermes/mạng
bun run pipeline          # lấy tin + Hermes biên tập (2–5 phút)
bun run pipeline:quick    # không gọi Hermes (gom nhóm dự phòng)
bun run dev               # http://127.0.0.1:3130 (hot reload)
bun run start             # production
```
Cấu hình qua `.env` (xem `.env.example`): cổng, lịch `REFRESH_CRON` (mặc định 8h30 sáng mỗi ngày), `ALLOW_MANUAL_REFRESH`, model Hermes, số bài…

## API
- `GET /api/digest` – bản tin hiện tại (JSON)
- `GET /api/status` – trạng thái pipeline, log, lần chạy kế tiếp
- `POST /api/refresh` – chạy lại pipeline (409 nếu đang chạy)

## Cấu trúc
```
src/
  config.ts
  server.ts               Bun.serve + Bun.cron
  sources/                vnexpress.ts (RSS) · znews.ts (HTMLRewriter) · baomoi.ts (__NEXT_DATA__)
  pipeline/               run.ts · hermes.ts · prompt.ts · normalize.ts · fallback.ts
  shared/                 types.ts · art.ts (SVG generative) · art-defaults.ts
web/                      index.html · app.ts · charts.ts · styles.css
scripts/                  doctor.ts · clean.sh (Bun Shell script)
data/                     latest.json · history/ · runs/<id>/{articles,prompt,hermes-output,hermes.log}
```
Nếu Hermes lỗi/timeout, pipeline tự chuyển sang biên tập dự phòng (gom cụm theo tiêu đề) để trang luôn có dữ liệu.
