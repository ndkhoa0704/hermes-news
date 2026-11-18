import type { ArtSpec, Category, Motif } from "./types";

const BY_CATEGORY: Record<Category, { motif: Motif; palette: string[] }> = {
  "thoi-su": { motif: "ripples", palette: ["#0b1d3a", "#ff6b6b", "#ffd166", "#f8f9fa"] },
  "the-gioi": { motif: "orbit", palette: ["#0a0f2c", "#4dabf7", "#a5d8ff", "#ffe066"] },
  "kinh-te": { motif: "rise", palette: ["#1b1b2f", "#ffd43b", "#f59f00", "#51cf66"] },
  "cong-nghe": { motif: "network", palette: ["#0d0221", "#9775fa", "#22d3ee", "#f0abfc"] },
  "the-thao": { motif: "pulse", palette: ["#062a1f", "#51cf66", "#fcc419", "#ffffff"] },
  "giai-tri": { motif: "bloom", palette: ["#2b0a3d", "#f783ac", "#ffa94d", "#ffe3e3"] },
  "suc-khoe": { motif: "pulse", palette: ["#032b2b", "#20c997", "#96f2d7", "#ff8787"] },
  "giao-duc": { motif: "particles", palette: ["#1a1033", "#ff922b", "#ffd8a8", "#74c0fc"] },
  "phap-luat": { motif: "shards", palette: ["#111318", "#868e96", "#e03131", "#dee2e6"] },
  "doi-song": { motif: "bloom", palette: ["#2d1b2e", "#e599f7", "#ffc9c9", "#fff3bf"] },
  "moi-truong": { motif: "mountains", palette: ["#08262b", "#38d9a9", "#8ce99a", "#d0ebff"] },
  "khoa-hoc": { motif: "orbit", palette: ["#050816", "#74c0fc", "#b197fc", "#fff9db"] },
};

export function defaultArt(category: Category, _seed: string): ArtSpec {
  const b = BY_CATEGORY[category] ?? BY_CATEGORY["thoi-su"];
  return { motif: b.motif, palette: b.palette, energy: 0.5, density: 0.5, caption: "" };
}
