import type { Article, Category, Story } from "../shared/types";
import { defaultArt } from "../shared/art-defaults";

// Biên tập dự phòng (không cần AI) khi Hermes lỗi: gom cụm theo độ trùng từ của tiêu đề.

const STOP = new Set("và của là có cho với các những được trong khi đã này một không người tại theo từ đến về sau hơn như vì nhiều bị ra lên để năm ngày mới nhất".split(" "));

const tokens = (s: string) => {
  const w = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((x) => x && !STOP.has(x));
  const out = new Set<string>();
  for (let i = 0; i < w.length - 1; i++) out.add(w[i] + " " + w[i + 1]);
  return out;
};

const RULES: [Category, RegExp][] = [
  ["the-thao", /bóng đá|tuyển|hlv|sea games|v-league|cầu thủ|giải đấu|olympic|thể thao|world cup|ngoại hạng/i],
  ["kinh-te", /giá|usd|chứng khoán|cổ phiếu|doanh nghiệp|ngân hàng|lãi suất|xuất khẩu|kinh doanh|vàng|bất động sản|gdp|thuế/i],
  ["cong-nghe", /trí tuệ nhân tạo|công nghệ|iphone|smartphone|chip|robot|ứng dụng|số hóa|internet|apple|google|nvidia/i],
  ["the-gioi", /mỹ|trung quốc|nga|ukraine|israel|châu âu|nhật|hàn quốc|liên hợp quốc|tổng thống|thủ tướng .* (anh|pháp|đức)/i],
  ["phap-luat", /khởi tố|bắt|xét xử|tòa|lừa đảo|công an|án|vi phạm|truy nã/i],
  ["suc-khoe", /bệnh|bác sĩ|bệnh viện|sức khỏe|vaccine|dịch|ung thư/i],
  ["giao-duc", /học sinh|sinh viên|giáo viên|trường|thi|đại học|giáo dục/i],
  ["moi-truong", /bão|lũ|mưa|ngập|thời tiết|môi trường|ô nhiễm|nắng nóng|động đất/i],
  ["giai-tri", /ca sĩ|phim|diễn viên|hoa hậu|nghệ sĩ|showbiz|mv|concert/i],
  ["khoa-hoc", /khoa học|nghiên cứu|vũ trụ|nasa|phát hiện/i],
  ["doi-song", /du lịch|ẩm thực|gia đình|lễ hội|văn hóa/i],
];

const guessCategory = (a: Article): Category => RULES.find(([, re]) => re.test(`${a.section ?? ""} ${a.title}`))?.[0] ?? "thoi-su";

export function fallbackStories(articles: Article[]): { headline: string; overview: string; stories: Story[] } {
  const toks = articles.map((a) => tokens(a.title + " " + a.summary));
  const clusterOf = new Array<number>(articles.length).fill(-1);
  const clusters: number[][] = [];
  for (let i = 0; i < articles.length; i++) {
    if (clusterOf[i] !== -1) continue;
    const c = [i];
    clusterOf[i] = clusters.length;
    for (let j = i + 1; j < articles.length; j++) {
      if (clusterOf[j] !== -1) continue;
      let inter = 0;
      for (const t of toks[i]!) if (toks[j]!.has(t)) inter++;
      if (inter >= 2) {
        c.push(j);
        clusterOf[j] = clusterOf[i]!;
      }
    }
    clusters.push(c);
  }
  clusters.sort((a, b) => b.length - a.length);
  const stories = clusters.slice(0, 18).map((c, i): Story => {
    const lead = articles[c[0]!]!;
    const category = guessCategory(lead);
    const id = `s${i + 1}-${lead.id}`;
    return {
      id,
      title: lead.title,
      summary: lead.summary,
      whyItMatters: c.length > 1 ? `${c.length} bài báo cùng đưa tin về sự kiện này.` : "",
      keyPoints: c.slice(1, 4).map((k) => articles[k]!.title),
      category,
      tags: [],
      sentiment: 0,
      importance: Math.min(5, 1 + c.length),
      articleIds: c.map((k) => articles[k]!.id),
      art: { ...defaultArt(category, id), energy: Math.min(1, 0.3 + c.length * 0.15) },
    };
  });
  return {
    headline: "Bản tin tổng hợp tự động",
    overview: "Hermes tạm thời không phản hồi nên bản tin này được gom nhóm tự động theo tiêu đề.",
    stories,
  };
}
