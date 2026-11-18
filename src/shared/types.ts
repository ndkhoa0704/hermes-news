// Kiểu dữ liệu dùng chung giữa pipeline (server) và giao diện (browser).

export type SourceId = "vnexpress" | "znews" | "baomoi";

/** Một bài báo thô thu thập từ nguồn. */
export interface Article {
  id: string; // id ngắn, ổn định theo URL (vd "a1b2c3d4")
  source: SourceId;
  publisher: string; // tên báo hiển thị (Báo Mới gom nhiều đầu báo)
  title: string;
  summary: string;
  url: string;
  image?: string;
  section?: string; // chuyên mục gốc của báo, nếu có
  publishedAt: string; // ISO
}

export const CATEGORIES = {
  "thoi-su": { label: "Thời sự", color: "#ff6b6b" },
  "the-gioi": { label: "Thế giới", color: "#4dabf7" },
  "kinh-te": { label: "Kinh tế", color: "#ffd43b" },
  "cong-nghe": { label: "Công nghệ", color: "#9775fa" },
  "the-thao": { label: "Thể thao", color: "#51cf66" },
  "giai-tri": { label: "Giải trí", color: "#f783ac" },
  "suc-khoe": { label: "Sức khỏe", color: "#20c997" },
  "giao-duc": { label: "Giáo dục", color: "#ff922b" },
  "phap-luat": { label: "Pháp luật", color: "#868e96" },
  "doi-song": { label: "Đời sống", color: "#e599f7" },
  "moi-truong": { label: "Môi trường", color: "#38d9a9" },
  "khoa-hoc": { label: "Khoa học", color: "#74c0fc" },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];

/** Các mô-típ hình ảnh trừu tượng mà renderer SVG hỗ trợ. */
export const MOTIFS = {
  waves: "dòng chảy, nước, lũ lụt, thời tiết, giao thông",
  rise: "tăng trưởng, kỷ lục, giá tăng, thành công",
  fall: "sụt giảm, khủng hoảng, giá giảm, thua lỗ",
  network: "kết nối, công nghệ, ngoại giao, mạng lưới, hợp tác",
  orbit: "vũ trụ, khoa học, toàn cầu, quan hệ quốc tế",
  shards: "xung đột, tai nạn, tội phạm, đổ vỡ, chiến sự",
  bloom: "văn hóa, đời sống, nghệ thuật, lễ hội, giải trí",
  grid: "đô thị, hạ tầng, quy hoạch, bất động sản, chính sách",
  pulse: "sức khỏe, y tế, thể thao, nhịp độ, cảm xúc mạnh",
  spiral: "bão, biến động, hỗn loạn, khủng hoảng lan rộng",
  ripples: "tác động lan tỏa, quyết định, luật mới, phát ngôn",
  particles: "đám đông, xã hội, dân số, giáo dục, cộng đồng",
  mountains: "thiên nhiên, du lịch, môi trường, nông nghiệp",
} as const;
export type Motif = keyof typeof MOTIFS;
export const MOTIF_IDS = Object.keys(MOTIFS) as Motif[];

/** Thông số để vẽ ảnh trừu tượng cho một câu chuyện. */
export interface ArtSpec {
  motif: Motif;
  palette: string[]; // 3-5 mã màu hex
  energy: number; // 0..1 — độ dữ dội / chuyển động
  density: number; // 0..1 — mật độ chi tiết
  caption: string; // một câu mô tả ẩn dụ của hình
}

/** Một câu chuyện tổng hợp (cụm nhiều bài cùng sự kiện) do Hermes biên tập. */
export interface Story {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  keyPoints: string[];
  category: Category;
  tags: string[];
  location?: string;
  sentiment: number; // -1 (tiêu cực) .. 1 (tích cực)
  importance: number; // 1..5
  articleIds: string[];
  art: ArtSpec;
}

export interface Digest {
  generatedAt: string;
  editor: "hermes" | "fallback";
  headline: string;
  overview: string;
  stories: Story[];
  articles: Article[];
  stats: {
    bySource: Record<string, number>;
    fetchErrors: Record<string, string>;
    hermesMs?: number;
    hourly?: { start: string; series: Record<string, number[]> };
  };
}
