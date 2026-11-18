# Kiến trúc hệ thống — Hermes News

Hệ thống tự động thu thập tin mới nhất từ **VnExpress, Znews, Báo Mới**, dùng **Hermes Agent** (Claude Sonnet 5)
để biên tập thành các "câu chuyện" và — với những câu chuyện có không gian vật lý cụ thể — dựng **bài đồ họa kể chuyện
có mô hình 3D** theo phong cách VnExpress Đồ họa. Kết quả phục vụ qua một web app responsive tại
`https://news.koanguyn.org`.

- Ngôn ngữ / runtime: **TypeScript trên Bun 1.4** (không có bước build riêng)
- Thư viện ngoài: `sortablejs` (kéo thả), `topojson-client` (dev, chỉ dùng khi sinh dữ liệu bản đồ)
- Lưu trữ: file JSON trong `data/` (không dùng database)

---

## 1. Tổng quan

```
                         ┌──────────────────────────── Bun process (pm2: hermes-news_3130) ───────────────────────────┐
                         │                                                                                             │
  Bun.cron "30 8 * * *" ─┼─▶ runPipeline()                                                                              │
  (Asia/Ho_Chi_Minh)     │     │                                                                                       │
                         │     ① Thu thập  ──▶ src/sources/*   fetch + Bun.XML / HTMLRewriter / __NEXT_DATA__          │
                         │     │                 └─ khử trùng lặp, lọc 24h, round-robin giữa nguồn (≤140 bài)          │
                         │     ▼                                                                                       │
                         │     ② Tổng biên tập ──▶ Bun Shell $`hermes chat … --query-file prompt.md`                   │
                         │     │                 └─ Hermes ghi hermes-output.json → normalize.ts                       │
                         │     │                    (gom cụm 14–22 câu chuyện, tóm tắt, cảm xúc, ArtSpec, model3d)     │
                         │     ▼                                                                                       │
                         │     ②b Ban Đồ họa ──▶ chọn câu chuyện model3d.feasible (≤5) → lấy toàn văn bài gốc          │
                         │     │                 └─ mỗi câu chuyện 1 lượt Hermes (song song 3) → visual.json           │
                         │     │                    → normalize-visual.ts (bắt buộc có mô hình iso ≥ 3 khối)           │
                         │     ▼                                                                                       │
                         │     ③ Ghi  data/latest.json · data/history/ · data/visual/<storyId>.json                    │
                         │                                                                                             │
                         │   Bun.serve  ── HTML imports (bundle web/*.html + TS + CSS) ── API JSON                     │
                         └──────────────────────────────────────────────────────────┬──────────────────────────────────┘
                                                                                    │ 127.0.0.1:3130
                                                                    Caddy (TLS, news.koanguyn.org, chặn /api/refresh)
                                                                                    │
                                                                                Trình duyệt
```

Pipeline chạy **trong cùng tiến trình** với web server (lịch in-process của `Bun.cron`, không chạy chồng lấn).
Có thể chạy tay bằng CLI (`bun run pipeline`) — tiến trình CLI ghi cùng thư mục `data/`, server đọc file ở mỗi request.

---

## 2. Thành phần

### 2.1 Thu thập tin — `src/sources/`

| File | Nguồn | Kỹ thuật |
|---|---|---|
| `vnexpress.ts` | 11 RSS chuyên mục (feed `tin-moi-nhat` hay bị cache cũ) | `Bun.XML.parse` |
| `znews.ts` | Trang chủ + 3 chuyên mục (không còn RSS) | `HTMLRewriter` theo `article.article-item` |
| `baomoi.ts` | `tin-moi.epi` + trang chủ (Next.js) | đọc JSON trong `<script id="__NEXT_DATA__">` |
| `fulltext.ts` | Toàn văn bài gốc cho ban Đồ họa | `HTMLRewriter`, selector riêng từng báo |
| `http.ts` | `fetchText` (UA, timeout), `articleId` (`Bun.hash` URL), giải mã entity, parse giờ VN | |
| `index.ts` | Gộp các nguồn song song | lọc `MAX_AGE_HOURS`, khử trùng tiêu đề chuẩn hoá, round-robin, histogram 24h theo nguồn |

Lỗi một nguồn không làm hỏng cả lượt: lỗi ghi vào `stats.fetchErrors`, các nguồn khác vẫn dùng được.

### 2.2 Gọi Hermes — `src/pipeline/hermes.ts`

Một hàm `runHermes(promptPath, outPath, cwd)` dùng chung cho mọi lượt AI:

```ts
$`timeout ${sec} hermes chat -Q --oneshot -t file --max-turns 12 --ignore-rules --source tool
   -m claude-sonnet-5 --provider anthropic --query-file ${promptPath}`
```

| Cờ | Lý do |
|---|---|
| `-Q --oneshot` | chế độ lập trình: trả lời một lần rồi thoát |
| `-t file` | chỉ cấp công cụ đọc/ghi file — Hermes **ghi JSON ra `outPath`** (ổn định hơn parse stdout) |
| `--ignore-rules` | bỏ persona/memory cá nhân của Hermes → văn phong báo chí trung lập |
| `--source tool` | không làm rối danh sách phiên chat của người dùng |
| `timeout` (coreutils) | chặn treo vô hạn (`HERMES_TIMEOUT_MS`, mặc định 15 phút) |
| `--query-file` | prompt dài, chứa ký tự đặc biệt — không qua shell |

Bun Shell tự escape mọi biến nội suy; mảng (`modelArgs`) được trải thành nhiều tham số.
Nếu file output không tồn tại, hàm thử bóc JSON từ stdout; log đầy đủ ở `data/runs/<id>/…/hermes.log`.

> ⚠️ Không dùng `--source <tên tuỳ ý>` — Hermes báo `invalid_params`. Chỉ `tool` (hoặc mặc định `cli`) hợp lệ.

### 2.3 Bước ② — Tổng biên tập

- Prompt: `src/pipeline/prompt.ts` — danh sách bài dạng JSON-lines (id, báo, mục, giờ, tiêu đề, tóm tắt ≤280 ký tự).
- Hermes trả `{ headline, overview, stories[] }`; mỗi story gồm tóm tắt, `whyItMatters`, `keyPoints`, `category`,
  `tags`, `location`, `sentiment` (-1..1), `importance` (1..5), `articleIds`, `art` (ArtSpec: mô-típ + bảng màu cho ảnh
  trừu tượng) và **`model3d`** `{ feasible, confidence 1–5, subject, reason }`.
- `normalize.ts`: kẹp giá trị, loại `articleIds` không tồn tại, bỏ story rỗng, sắp theo importance.
- Dự phòng: Hermes lỗi hoặc < 3 story → `fallback.ts` gom cụm theo bigram tiêu đề + luật từ khoá (`editor: "fallback"`).

### 2.4 Bước ②b — Ban Đồ họa (bài kể chuyện có mô hình 3D)

Ba cổng lọc để **chỉ làm khi thật sự dựng được 3D** (không cố tạo hình):

1. **Tổng biên tập chấm `model3d`** theo 3 tiêu chí: tâm điểm là vật thể/không gian vật lý cụ thể; nguồn có chi tiết
   hình khối/bố cục; mô hình giúp hiểu câu chuyện hơn chữ. Giá cả, phát ngôn, ngoại giao, thể thao… luôn `false`.
2. **`pickVisualStories`** (`visual.ts`): chỉ lấy `feasible && confidence ≥ 3`, tối đa `VISUAL_COUNT` (có thể 0).
3. **Hermes tự đánh giá lại** sau khi đọc toàn văn (`visual-prompt.ts`, "Bước 0"): thiếu chi tiết → ghi
   `{"skip": true, "reason": …}`. `normalize-visual.ts` loại mọi bài không có đồ họa `iso` ≥ 3 khối.

Mỗi câu chuyện được chọn: lấy toàn văn ≤3 bài gốc (ưu tiên VnExpress/Znews) → prompt → Hermes ghi `visual.json`
(schema `src/shared/visual-types.ts`) → chuẩn hoá → `data/visual/<storyId>.json`, story được gắn `hasVisual: true`.
Chạy song song `VISUAL_CONCURRENCY` (mặc định 3), mỗi lượt ~1,5–3 phút.

**Cấu trúc một bài đồ họa (`VisualStory`)**: `kicker`, `title`, `dek`, `hero` (bắt buộc `iso`), `heroState`,
`stateLabels` (vd `quy-hoach` → "Quy hoạch được duyệt"), `chapters[]` (mỗi chương: `heading`, `graphic` sticky,
`steps[]` với `text` + `focus` (key phần tử cần làm nổi) + `state`), `factbox`, `dataNotes` ("Về dữ liệu").

**Thư viện đồ họa** (`Graphic`): `iso` · `compare` · `units` · `bignumber` · `timeline` · `map` · `flow` · `actors` ·
`bars` · `quote`.

### 2.5 Ghi dữ liệu — `src/pipeline/run.ts`

- `data/latest.json` — bản tin hiện hành (ghi file tạm rồi `mv` cho nguyên tử).
- `data/history/<runId>.json` — lưu mọi bản tin.
- `data/visual/<storyId>.json` — bài đồ họa; tự xoá file > 3 ngày.
- `data/runs/<runId>/` — artefact gỡ lỗi (articles, prompt, hermes-output, hermes.log, `visual/<storyId>/…`); giữ 24 lần gần nhất.

CLI: `--no-hermes` (chỉ fallback), `--no-visual` (bỏ ban Đồ họa), `--visual-only` (dựng lại đồ họa cho `latest.json`).

### 2.6 Web server — `src/server.ts`

`Bun.serve` với **HTML imports**: Bun tự bundle `web/index.html`, `web/story.html` cùng TS/CSS được tham chiếu
(dev: HMR; production `NODE_ENV=production`: minify + cache trong bộ nhớ).

| Route | Mô tả |
|---|---|
| `GET /` | Trang tổng hợp |
| `GET /story/:id` | Trang bài đồ họa kể chuyện |
| `GET /api/digest` | `latest.json` |
| `GET /api/visuals` | Danh sách bài đồ họa của bản tin hiện tại (kèm `hero` để vẽ thumbnail) |
| `GET /api/story/:id` | Một bài đồ họa (id được kiểm tra `^[A-Za-z0-9_-]{1,80}$`) |
| `GET /api/status` | Trạng thái pipeline, log, lần chạy kế tiếp (`Bun.cron.parse`) |
| `POST /api/refresh` | Chạy pipeline thủ công — **403 khi `ALLOW_MANUAL_REFRESH=false`** (production) |
| `GET /geo/(world\|sea).json` | Dữ liệu bản đồ (cache 7 ngày) |
| `GET /healthz` | Kiểm tra sống |

### 2.7 Frontend — `web/`

**Trang tổng hợp** (`index.html`, `app.ts`, `charts.ts`, `styles.css`)
- Hero (headline + overview + câu chuyện số 1), dải **"◆ Đồ họa kể chuyện"** (thumbnail vẽ từ `hero`), lưới câu chuyện,
  bảng **📌 Theo dõi**, **⚡ Tin nhanh**, khu **Toàn cảnh** gồm 6 biểu đồ SVG thuần: bản đồ cảm xúc, donut chủ đề,
  theo nguồn báo, nhịp đăng tin 24h, bong bóng từ khoá, địa điểm.
- Kéo thả bằng SortableJS (`forceFallback` → đồng nhất chuột/cảm ứng): sắp xếp lưới, ghim sang Theo dõi, đổi chỗ biểu đồ.
  Trạng thái lưu `localStorage` (`hn:*`).
- Ảnh trừu tượng cho mỗi câu chuyện: `src/shared/art.ts` vẽ SVG từ `ArtSpec` (13 mô-típ, seed theo story id).

**Trang bài đồ họa** (`story.html`, `story.ts`, `story.css`, `graphics/`)
- Scrollytelling: đồ họa `position: sticky`, các thẻ văn bản cuộn qua; `IntersectionObserver` áp `focus`/`state`
  của bước đang ở giữa màn hình (điện thoại: vùng kích hoạt nửa dưới vì đồ họa chiếm nửa trên).
- Hero tự chuyển cảnh giữa các state cho tới khi người đọc bấm nút chuyển (`g-states`).
- `graphics/iso.ts` — mô hình isometric bằng SVG: chiếu iso, mặt trái/phải/mái, cửa sổ bằng `<pattern>` biến đổi theo
  mặt, dải tầng tô đỏ (`highlightFloors`), bóng đổ, thiết bị mái, nền lưới phố có mask mờ dần, nhãn tự co giãn theo
  cỡ cảnh, gộp nhãn trùng; thứ tự vẽ theo thuật toán painter.
- `graphics/map.ts` — Việt Nam (Natural Earth 1:50m, **luôn kèm Q.đ. Hoàng Sa, Trường Sa**), thế giới (tự khớp vùng
  điểm), "local" (nền phố giản lược + bản đồ định vị). `normalize-visual` tự sửa `scope` theo toạ độ thật.
- `graphics/index.ts` — `mountGraphic`, `applyStep`, `countUp` cho các loại còn lại.
- `graphics/graphics.css` — style đồ họa dùng chung cho trang bài và thumbnail trang chủ.

---

## 3. Mô hình dữ liệu (rút gọn)

```ts
Article  { id, source: "vnexpress"|"znews"|"baomoi", publisher, title, summary, url, image?, section?, publishedAt }
Story    { id, title, summary, whyItMatters, keyPoints[], category, tags[], location?, sentiment, importance,
           articleIds[], art: ArtSpec, model3d?: {feasible, confidence, subject?, reason?}, hasVisual? }
Digest   { generatedAt, editor: "hermes"|"fallback", headline, overview, stories[], articles[],
           stats: { bySource, fetchErrors, hermesMs?, hourly? } }
VisualStory { storyId, kicker, title, dek, hero: Graphic, heroState?, heroCaption?, stateLabels?,
              chapters: { heading?, graphic?, steps: { text, focus?, state? }[] }[],
              factbox?, dataNotes[], articleIds[], generatedAt }
IsoBlock { key, label?, kind: "tower"|"house"|"base"|"box"|"tree", x, y, w, d, floors, z?,
           highlight?, highlightFloors?: [from, to], showIn?: string[] }
```

Định nghĩa đầy đủ: `src/shared/types.ts`, `src/shared/visual-types.ts`.

---

## 4. Triển khai

| Thành phần | Chi tiết |
|---|---|
| Process manager | pm2, app `hermes-news_3130`, `ecosystem.config.cjs` (chạy thẳng binary `~/.bun/bin/bun src/server.ts`) |
| Khởi động lại khi reboot | `pm2 save` + unit systemd user `pm2-our-memory.service` (`pm2 resurrect`) |
| Mạng | lắng nghe `127.0.0.1:3130`; Caddy reverse proxy `news.koanguyn.org` (TLS tự động), block mẫu ở `deploy/Caddyfile.news` |
| Bảo vệ chi phí | `ALLOW_MANUAL_REFRESH=false` (app trả 403) + Caddy chặn `/api/refresh` |
| Lịch | `REFRESH_CRON=30 8 * * *`, `TZ_CRON=Asia/Ho_Chi_Minh` — chỉ tổng hợp 1 lần/ngày |
| Thời gian một lượt | thu thập ~1–20 s · tổng biên tập ~3–5 phút · ban Đồ họa ~3–6 phút (tuỳ số bài đạt chuẩn) |

**Biến môi trường** (`.env.example`): `PORT`, `HOST`, `REFRESH_CRON`, `TZ_CRON`, `ALLOW_MANUAL_REFRESH`, `HERMES_BIN`,
`HERMES_MODEL` (mặc định `claude-sonnet-5`), `HERMES_PROVIDER` (`anthropic`), `HERMES_TIMEOUT_MS`, `MAX_ARTICLES`,
`MAX_AGE_HOURS`, `VISUAL_COUNT`, `VISUAL_CONCURRENCY`.

---

## 5. Cấu trúc thư mục

```
hermes-news/
├── ARCHITECTURE.md · README.md · AGENTS.md
├── ecosystem.config.cjs          pm2
├── deploy/Caddyfile.news         block Caddy
├── scripts/
│   ├── doctor.ts                 kiểm tra bun / hermes / mạng (Bun Shell)
│   ├── build-geo.ts              sinh web/geo/*.json từ world-atlas
│   └── clean.sh                  script Bun Shell dọn data
├── src/
│   ├── config.ts                 cấu hình từ env
│   ├── server.ts                 Bun.serve + Bun.cron
│   ├── sources/                  vnexpress · znews · baomoi · fulltext · http · index
│   ├── pipeline/                 run · hermes · prompt · normalize · fallback ·
│   │                             visual · visual-prompt · normalize-visual
│   └── shared/                   types · visual-types · art · art-defaults
├── web/
│   ├── index.html · app.ts · charts.ts · styles.css        trang tổng hợp
│   ├── story.html · story.ts · story.css                   trang bài đồ họa
│   ├── graphics/                 index · iso · map · util · graphics.css
│   └── geo/                      world.json · sea.json
└── data/                         (git-ignored) latest.json · history/ · visual/ · runs/
```

---

## 6. Lỗi & dự phòng

| Tình huống | Xử lý |
|---|---|
| Một báo lỗi / đổi HTML | bỏ qua nguồn đó, ghi `fetchErrors`, hiện cảnh báo trên header |
| Hermes lỗi, timeout, JSON hỏng | fallback gom cụm tự động; trang vẫn có bản tin |
| Ban Đồ họa lỗi một bài | bỏ bài đó, các bài khác vẫn xuất bản |
| Không câu chuyện nào dựng được 3D | không làm bài đồ họa nào trong ngày (dải "Đồ họa kể chuyện" tự ẩn) |
| Pipeline đang chạy | `refresh()` từ chối chạy chồng; `Bun.cron` không chồng lấn |
| Server crash | pm2 `autorestart`, giới hạn `max_memory_restart: 400M` |

---

## 7. Kiểm tra & vận hành

```bash
bun check                                  # type-check toàn bộ
bun run doctor                             # môi trường
bun run pipeline                           # chạy đủ (≈10 phút)
bun run pipeline:quick                     # không gọi AI
bun src/pipeline/run.ts --visual-only      # dựng lại bài đồ họa
pm2 logs hermes-news_3130                  # log server + pipeline theo lịch
curl -s localhost:3130/api/status          # trạng thái, lần chạy kế tiếp
```

Ghi chú kiểm thử bằng trình duyệt headless: trang có `scroll-behavior: smooth` làm headless Chromium treo khi
`scrollTo` — dùng `scrollTo({ behavior: "instant" })`.
