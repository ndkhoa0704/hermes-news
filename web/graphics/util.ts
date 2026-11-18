export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export const COLORS = {
  ink: "#222222",
  muted: "#757575",
  accent: "#9f224e",
  hot: "#c8432f",
  hotDark: "#9e3222",
  paper: "#fcfaf6",
  line: "#e3ddd3",
  cold: "#b9b2a7",
};

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed: string) {
  let a = hashStr(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
