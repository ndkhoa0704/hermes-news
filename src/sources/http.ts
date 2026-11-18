import { config } from "../config";

export async function fetchText(url: string, timeoutMs = 20_000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": config.userAgent,
      "accept-language": "vi-VN,vi;q=0.9,en;q=0.6",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

/** id ngắn, ổn định theo URL. */
export function articleId(url: string): string {
  return "a" + Bun.hash(url.replace(/[#?].*$/, "")).toString(36).slice(0, 8);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function clean(s: string | undefined | null): string {
  return decodeEntities((s ?? "").replace(/<[^>]*>/g, " ")).replace(/[\u200b\u00a0\s]+/g, " ").trim();
}

/** "14:13 18/11/2026" (giờ VN) -> ISO */
export function parseVnDateTime(s: string): string | undefined {
  const m = s.match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return undefined;
  const [, hh, mm, dd, MM, yyyy] = m;
  const pad = (x: string) => x.padStart(2, "0");
  const d = new Date(`${yyyy}-${pad(MM!)}-${pad(dd!)}T${pad(hh!)}:${mm}:00+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
