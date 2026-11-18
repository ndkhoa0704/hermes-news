// Kiểu dữ liệu cho bài "đồ họa kể chuyện" (longform scrollytelling) kiểu VnExpress Đồ họa.
// Hermes tạo JSON theo schema này; trình duyệt render bằng web/graphics/*.

export interface Focusable {
  /** Danh sách key (label) cần làm nổi ở bước hiện tại; rỗng = hiện đều. */
  focus?: string[];
  /** Trạng thái cảnh (vd "quy-hoach" | "thuc-te") cho đồ họa iso / units. */
  state?: string;
}

export interface IsoBlock {
  key: string; // nhãn duy nhất, vd "CT6C"
  label?: string; // nhãn hiển thị (mặc định = key)
  kind: "tower" | "house" | "base" | "box" | "tree";
  x: number; // toạ độ lưới 0..60
  y: number;
  w: number; // rộng theo trục x
  d: number; // sâu theo trục y
  floors: number; // số tầng (1 tầng = 1 đơn vị cao)
  z?: number; // cao độ đáy (tầng), mặc định 0
  highlight?: boolean; // tô màu nhấn (sai phạm / điểm nóng)
  highlightFloors?: [number, number]; // chỉ tô từ tầng a đến b
  showIn?: string[]; // chỉ hiện trong các state này
}

export type Graphic =
  | { type: "iso"; title?: string; legend?: { normal: string; highlight: string }; blocks: IsoBlock[] }
  | { type: "compare"; title?: string; leftLabel: string; rightLabel: string; rows: { key: string; left: number; right: number; unit?: string }[]; note?: string }
  | { type: "units"; title?: string; unit: string; perDot?: number; groups: { key: string; value: number; highlight?: boolean; showIn?: string[] }[] }
  | { type: "bignumber"; value: string; label: string; sub?: string }
  | { type: "timeline"; title?: string; events: { key: string; date: string; title: string; text?: string; highlight?: boolean }[] }
  | { type: "map"; title?: string; scope: "vietnam" | "world" | "local"; points: { key: string; lat: number; lon: number; value?: number; note?: string; highlight?: boolean }[] }
  | { type: "flow"; title?: string; steps: { key: string; label: string; text?: string; highlight?: boolean }[] }
  | { type: "actors"; title?: string; nodes: { key: string; role: string; group?: string }[]; links: { from: string; to: string; label?: string }[] }
  | { type: "bars"; title?: string; unit?: string; items: { key: string; value: number; highlight?: boolean }[] }
  | { type: "quote"; text: string; who: string };

export type GraphicType = Graphic["type"];

export interface VisualStep extends Focusable {
  text: string;
}

export interface VisualChapter {
  heading?: string;
  graphic?: Graphic; // đồ họa "dính" (sticky) cho chương; không có = đoạn văn thường
  steps: VisualStep[];
}

export interface VisualStory {
  storyId: string;
  kicker: string; // chuyên mục / nhãn nhỏ trên tiêu đề
  title: string;
  dek: string; // sapo
  hero: Graphic;
  heroState?: string;
  heroCaption?: string;
  /** Nhãn hiển thị cho các state (vd {"quy-hoach":"Quy hoạch được duyệt","thuc-te":"Thực tế"}). */
  stateLabels?: Record<string, string>;
  chapters: VisualChapter[];
  factbox?: { label: string; value: string }[];
  dataNotes: string[];
  articleIds: string[];
  generatedAt: string;
}
