import type { Article } from "../shared/types";
import { CATEGORIES, MOTIFS } from "../shared/types";

/** Tạo prompt cho Hermes: biên tập viên tổng hợp tin + đạo diễn hình ảnh trừu tượng. */
export function buildPrompt(articles: Article[], outPath: string, now = new Date()): string {
  const lines = articles.map((a) =>
    JSON.stringify({
      id: a.id,
      bao: a.publisher,
      muc: a.section,
      gio: new Date(a.publishedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
      tieu_de: a.title,
      tom_tat: a.summary.slice(0, 280),
    }),
  );
  const cats = Object.entries(CATEGORIES).map(([k, v]) => `"${k}" (${v.label})`).join(", ");
  const motifs = Object.entries(MOTIFS).map(([k, v]) => `- "${k}": ${v}`).join("\n");

  return `Bạn là tổng biên tập của một trang tin tổng hợp tiếng Việt, đồng thời là đạo diễn nghệ thuật.
Thời điểm hiện tại: ${now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ Việt Nam).

Dưới đây là ${articles.length} bài báo mới nhất lấy từ VnExpress, Znews và Báo Mới (mỗi dòng là một JSON).

NHIỆM VỤ
1. Gom các bài nói về CÙNG một sự kiện/chủ đề thành một "câu chuyện". Chọn ra 14–22 câu chuyện đáng chú ý nhất
   (ưu tiên sự kiện có nhiều báo cùng đưa, tác động rộng, mới nhất). Bỏ qua tin rao vặt, quảng cáo, tử vi.
2. Với mỗi câu chuyện, viết lại bằng tiếng Việt tự nhiên, trung lập, KHÔNG bịa thêm chi tiết ngoài dữ liệu được cung cấp.
3. Thiết kế một hình ảnh trừu tượng ẩn dụ cho câu chuyện bằng cách chọn mô-típ + bảng màu phù hợp cảm xúc sự kiện.

ĐẦU RA: dùng công cụ ghi file để ghi DUY NHẤT một file JSON hợp lệ (UTF-8, không markdown, không comment) vào đường dẫn:
${outPath}

Cấu trúc JSON:
{
  "headline": "tiêu đề tổng quan cho bản tin lúc này (≤ 90 ký tự)",
  "overview": "2–3 câu tóm tắt bức tranh tin tức chung",
  "stories": [
    {
      "title": "tiêu đề câu chuyện, súc tích (≤ 100 ký tự)",
      "summary": "tóm tắt 2–4 câu",
      "whyItMatters": "1–2 câu: vì sao người đọc nên quan tâm",
      "keyPoints": ["3–5 ý chính ngắn gọn, có số liệu nếu bài gốc có"],
      "category": một trong: ${cats},
      "tags": ["2–5 từ khóa ngắn"],
      "location": "địa danh chính nếu có, ngược lại bỏ trống",
      "sentiment": số từ -1 (rất tiêu cực) đến 1 (rất tích cực),
      "importance": số nguyên 1–5,
      "articleIds": ["id các bài thuộc câu chuyện, lấy đúng từ dữ liệu"],
      "model3d": {
        "feasible": true/false — có dựng được MÔ HÌNH 3D minh họa trung thực từ dữ liệu bài báo không (xem tiêu chí bên dưới),
        "confidence": số nguyên 1–5 (5 = nguồn mô tả rất rõ hình khối/bố cục),
        "subject": "vật thể/không gian sẽ dựng, vd: 'ba tòa tháp CT6 trên khối đế 3 tầng và 38 nhà liền kề'" (bỏ trống nếu false),
        "reason": "1 câu giải thích"
      },
      "art": {
        "motif": một trong các mô-típ bên dưới,
        "palette": ["3–5 mã màu hex #rrggbb hợp cảm xúc: tông lạnh/tối cho tin buồn, ấm/sáng cho tin vui"],
        "energy": 0..1 (độ dữ dội, chuyển động),
        "density": 0..1 (mật độ chi tiết),
        "caption": "1 câu mô tả ẩn dụ của hình, ví dụ: 'Những gợn sóng xanh lan ra từ một tâm điểm — chính sách mới chạm tới hàng triệu người'"
      }
    }
  ]
}

TIÊU CHÍ "model3d.feasible" — chỉ true khi THỎA CẢ BA:
  (a) Tâm điểm câu chuyện là một VẬT THỂ HOẶC KHÔNG GIAN VẬT LÝ cụ thể: tòa nhà, dự án, công trình, cây cầu, đường, cống,
      nhà máy, sân bay, cảng, trường, bệnh viện, hiện trường tai nạn/cháy/sập, khu đất, phương tiện/đội hình…
  (b) Bài viết có chi tiết hình khối/bố cục đủ để dựng lại: số tòa, số tầng, chiều cao, kích thước, diện tích, số nhà,
      vị trí tương đối các hạng mục, phần nào bị sửa đổi/hư hại/xây thêm…
  (c) Mô hình giúp người đọc hiểu câu chuyện hơn so với chữ (vd: so sánh quy hoạch với thực tế, phần bị phá hủy, quy mô công trình).
  Luôn false với: biến động giá/thị trường, phát ngôn, hội nghị/ngoại giao, kết quả thể thao, chính sách chung chung,
  vụ án không gắn với công trình/hiện trường cụ thể, tin người nổi tiếng, chiến sự chỉ có tên địa danh. Đừng cố gắng: nếu phân vân, chọn false.

MÔ-TÍP HÌNH ẢNH:
${motifs}

Sắp xếp "stories" theo importance giảm dần. Sau khi ghi file xong, chỉ trả lời đúng một từ: XONG

DỮ LIỆU BÀI BÁO:
${lines.join("\n")}
`;
}
