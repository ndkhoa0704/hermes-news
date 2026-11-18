import type { Article, Story } from "../shared/types";

export interface SourceDoc {
  article: Article;
  text: string;
}

/** Prompt cho "ban Đồ họa": biến một câu chuyện thành bài longform kể chuyện bằng đồ họa. */
export function buildVisualPrompt(story: Story, docs: SourceDoc[], outPath: string): string {
  const sources = docs
    .map(
      (d, i) => `### Nguồn ${i + 1} — ${d.article.publisher} (${new Date(d.article.publishedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})
id: ${d.article.id}
Tiêu đề: ${d.article.title}
Sapo: ${d.article.summary}
Toàn văn:
${d.text || "(không lấy được toàn văn — chỉ dùng sapo)"}`,
    )
    .join("\n\n");

  return `Bạn là phóng viên kiêm biên tập viên của BAN ĐỒ HỌA một báo điện tử lớn tại Việt Nam.
Phong cách của ban: các bài longform "kể chuyện bằng đồ họa" (scrollytelling) như bài
"Giải phẫu sai phạm tại tổ hợp chung cư của Mường Thanh" của VnExpress — mô hình 3D isometric các tòa nhà, phần sai phạm tô đỏ;
người đọc cuộn trang, đồ họa đứng yên (sticky) và lần lượt làm nổi từng chi tiết theo đoạn văn; có biểu đồ "Quy hoạch được duyệt
và hiện trạng" (mỗi chỉ tiêu một thang đo riêng), bản đồ vị trí, dòng thời gian, hộp số liệu và mục "Về dữ liệu" ở cuối bài.

NHIỆM VỤ: dựng một bài đồ họa kể chuyện tiếng Việt cho câu chuyện dưới đây, dựa HOÀN TOÀN vào các nguồn được cung cấp.

## Câu chuyện (do tổng biên tập gom cụm)
Tiêu đề tạm: ${story.title}
Tóm tắt: ${story.summary}
Góc khai thác gợi ý: ${story.visualAngle ?? "(tự chọn)"}
Địa điểm: ${story.location ?? "(không rõ)"}

## Nguyên tắc biên tập
1. CHÍNH XÁC TUYỆT ĐỐI: mọi con số, tên người, ngày tháng phải có trong nguồn. Không suy diễn, không làm tròn sai, không bịa.
   Nếu nguồn thiếu số liệu cho một loại đồ họa thì KHÔNG dùng loại đó. Toạ độ (lat/lon) chỉ cần đúng ở mức thành phố/tỉnh/quốc gia.
2. Tiêu đề hấp dẫn kiểu báo đồ họa: "Giải phẫu…", "Toàn cảnh…", "Từ A đến B: …", "… qua 5 con số" (≤ 80 ký tự).
   Sapo (dek) 1–2 câu, nêu ngay con số/độ chênh gây chú ý nhất.
3. Cấu trúc: 3–5 chương. Mỗi chương có 1 đồ họa sticky và 2–4 "bước" (steps). Mỗi bước là đoạn văn 35–90 từ, kể một ý,
   và chỉ định phần đồ họa cần làm nổi bằng "focus" (danh sách key của phần tử trong đồ họa) và/hoặc "state".
   Chương cuối có thể không có đồ họa (chỉ văn bản) để kết luận/hệ quả/bước tiếp theo.
4. Dùng ít nhất 3 LOẠI đồ họa khác nhau trong cả bài (tính cả hero). Ưu tiên SO SÁNH (kế hoạch vs thực tế, trước vs sau,
   năm nay vs năm trước), QUY MÔ (units), DIỄN BIẾN (timeline), KHÔNG GIAN (map/iso), QUAN HỆ (actors/flow).
5. HÌNH ẢNH LÀ TRỌNG TÂM: mỗi bài BẮT BUỘC có ít nhất một đồ họa không gian ("iso" hoặc "map"), và hero nên là "iso"
   hoặc "map". Dùng "iso" (mô hình 3D minh họa) cho mọi câu chuyện có vật thể/không gian cụ thể: tòa nhà, dự án, nhà máy,
   cây cầu, sân bay, bến cảng, trường học, bệnh viện, hiện trường tai nạn/cháy nổ/vụ án, đoàn xe, đội hình… — dựng lại bố cục
   giản lược theo mô tả trong nguồn, tô đỏ phần là tâm điểm câu chuyện (sai phạm, nơi xảy ra sự việc, phần tăng thêm).
   Dùng "map" cho sự kiện trải trên nhiều địa điểm/quốc gia. Chỉ dùng "bignumber" làm hero khi câu chuyện thuần số liệu.
6. Văn phong báo chí trung lập, câu ngắn, giàu thông tin. Không dùng emoji. Không xưng "tôi/mình".
7. "dataNotes": 2–4 dòng "Về dữ liệu" — nguồn số liệu (tên báo/cơ quan), và ghi rõ đồ họa nào chỉ mang tính minh họa
   (ví dụ: "Mô hình 3D minh họa tỉ lệ và số lượng, không phải bản vẽ kiến trúc").

## Thư viện đồ họa (chỉ dùng đúng các loại và trường sau)
- iso — mô hình 3D isometric các khối nhà/công trình trên lưới 60×60.
  { "type":"iso", "title":"…", "legend":{"normal":"Trong quy hoạch","highlight":"Sai quy hoạch"},
    "blocks":[{ "key":"CT6C", "label":"CT6C", "kind":"tower|house|base|box|tree", "x":20, "y":10, "w":12, "d":12, "floors":32,
                "z":0, "highlight":true, "highlightFloors":[29,32], "showIn":["thuc-te"] }] }
  Hướng dẫn: bố cục GỌN và LIỀN MẠCH như một khu đất thật (các khối sát nhau, nằm trong vùng ~40×40), 5–25 khối;
  x,y là góc khối trên lưới (0–60), w,d là kích thước (tháp 8–16, nhà liền kề w 3–4 d 8, khối đế rộng 20–40, floors 2–5);
  floors = số tầng thật (tối đa 60); "z" = cao độ đáy tính bằng tầng (tháp trên khối đế 4 tầng → z:4). Khối không chồng lấn nhau
  trên mặt bằng trừ khi dùng z. "highlight" tô đỏ toàn khối; "highlightFloors" chỉ tô một dải tầng.
  Dùng "showIn" + "state" ở từng bước để chuyển cảnh (vd "quy-hoach" → "thuc-te"). Khối không có showIn hiện ở mọi state.
  Có thể dùng cho cả hiện trường tai nạn/cháy/nhà máy/cây cầu (kind "box" là khối tổng quát; "tree" là cây xanh).
  Chỉ đặt "label" cho 2–6 khối quan trọng; nhãn ngắn (≤ 18 ký tự). Mô hình iso nên được dùng lại ở chương sau với các
  bước "focus" lần lượt vào từng khối để giải thích chi tiết (như bài Mường Thanh: lần lượt CT6C, CT6B, khối đế, nhà liền kề).
- compare — so sánh từng chỉ tiêu giữa hai trạng thái (mỗi hàng một thang đo riêng).
  { "type":"compare", "title":"Quy hoạch được duyệt và hiện trạng", "leftLabel":"Được duyệt", "rightLabel":"Thực tế",
    "rows":[{"key":"Căn hộ","left":231,"right":1582,"unit":"căn"}], "note":"Mỗi chỉ tiêu một thang đo riêng." }
- units — biểu đồ chấm (waffle) thể hiện quy mô; mỗi chấm = perDot đơn vị.
  { "type":"units", "title":"…", "unit":"căn", "perDot":10, "groups":[{"key":"Được cấp sổ","value":934},{"key":"Chưa cấp sổ","value":519,"highlight":true}] }
- bignumber — { "type":"bignumber", "value":"18.184", "label":"căn hộ xây vượt phép", "sub":"gấp 3,7 lần số được duyệt" }
- timeline — { "type":"timeline", "title":"…", "events":[{"key":"2008","date":"2008","title":"…","text":"…","highlight":false}] }
- map — { "type":"map", "title":"…", "scope":"vietnam|world|local", "points":[{"key":"Hà Nội","lat":21.03,"lon":105.85,"value":12,"note":"…","highlight":true}] }
  ("local" = các điểm trong cùng một thành phố; vẽ trên nền phố phường giản lược, toạ độ tương đối là đủ.)
- flow — chuỗi bước/quy trình/cơ chế: { "type":"flow", "title":"…", "steps":[{"key":"…","label":"…","text":"…","highlight":true}] }
- actors — quan hệ các bên: { "type":"actors", "title":"…", "nodes":[{"key":"Lê Thanh Thản","role":"Chủ tịch HĐQT Bemes","group":"Doanh nghiệp"}],
  "links":[{"from":"…","to":"…","label":"…"}] }
- bars — { "type":"bars", "title":"…", "unit":"…", "items":[{"key":"…","value":12,"highlight":true}] }
- quote — { "type":"quote", "text":"…", "who":"…" }

Các key trong "focus" phải trùng đúng "key" của phần tử trong đồ họa của chương đó.

## Đầu ra
Dùng công cụ ghi file để ghi DUY NHẤT một file JSON hợp lệ (UTF-8, không markdown) vào: ${outPath}
{
  "kicker": "nhãn chuyên mục ngắn, vd: Đồ họa · Thời sự",
  "title": "…",
  "dek": "…",
  "hero": { …một đồ họa… },
  "heroState": "state ban đầu của hero nếu dùng showIn (tuỳ chọn)",
  "stateLabels": { "quy-hoach": "Quy hoạch được duyệt", "thuc-te": "Thực tế" },   // bắt buộc nếu có dùng state
  "heroCaption": "chú thích ngắn cho hero",
  "chapters": [
    { "heading": "tiêu đề chương (tuỳ chọn)", "graphic": { … }, "steps": [ { "text": "…", "focus": ["…"], "state": "…" } ] }
  ],
  "factbox": [ { "label": "…", "value": "…" } ],
  "dataNotes": [ "…" ]
}
Sau khi ghi file, chỉ trả lời: XONG

## Nguồn tin
${sources}
`;
}
