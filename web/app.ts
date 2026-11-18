import Sortable from "sortablejs";
import { renderArt } from "../src/shared/art";
import { CATEGORIES, type Article, type Category, type Digest, type Story } from "../src/shared/types";
import { bubbles, donut, esc, hbars, moodMap, timeline, type Datum } from "./charts";

// ───────────────────────── trạng thái ─────────────────────────
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem("hn:" + k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    localStorage.setItem("hn:" + k, JSON.stringify(v));
  },
};

interface Pin {
  id: string;
  title: string;
  category: Category;
  art: Story["art"];
  url?: string;
}

let digest: Digest | null = null;
let articleMap = new Map<string, Article>();
let storyMap = new Map<string, Story>();
const ui = {
  q: "",
  cat: "all" as Category | "all",
  sort: LS.get<string>("sort", "custom"),
  order: LS.get<string[]>("order", []),
  pins: LS.get<Pin[]>("pins", []),
};

const SOURCE_META: Record<string, { label: string; color: string }> = {
  vnexpress: { label: "VnExpress", color: "#ff5c8a" },
  znews: { label: "Znews", color: "#4dabf7" },
  baomoi: { label: "Báo Mới", color: "#ffa94d" },
};

const catOf = (c: Category) => CATEGORIES[c] ?? CATEGORIES["thoi-su"];
const storyArticles = (s: Story) => s.articleIds.map((id) => articleMap.get(id)).filter(Boolean) as Article[];
const storyTime = (s: Story) => Math.max(0, ...storyArticles(s).map((a) => Date.parse(a.publishedAt)));
const artCache = new Map<string, string>();
const art = (spec: Story["art"], seed: string) => {
  const k = seed + spec.motif;
  if (!artCache.has(k)) artCache.set(k, renderArt(spec, seed));
  return artCache.get(k)!;
};

function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

function moodLabel(s: number) {
  if (s <= -0.5) return { t: "Rất tiêu cực", e: "😢" };
  if (s < -0.15) return { t: "Tiêu cực", e: "😟" };
  if (s <= 0.15) return { t: "Trung lập", e: "😐" };
  if (s < 0.5) return { t: "Tích cực", e: "🙂" };
  return { t: "Rất tích cực", e: "😄" };
}

// ───────────────────────── tải dữ liệu ─────────────────────────
async function loadDigest() {
  const res = await fetch("/api/digest", { cache: "no-store" });
  if (!res.ok) {
    showProgress(true);
    pollStatus();
    return;
  }
  digest = (await res.json()) as Digest;
  articleMap = new Map(digest.articles.map((a) => [a.id, a]));
  storyMap = new Map(digest.stories.map((s) => [s.id, s]));
  renderAll();
}

function renderAll() {
  if (!digest) return;
  renderTopMeta();
  renderHero();
  renderChips();
  renderGrid();
  renderWatch();
  renderTicker();
  renderWidgets();
}

// ───────────────────────── header / hero ─────────────────────────
function renderTopMeta() {
  const d = digest!;
  const t = new Date(d.generatedAt);
  const errs = Object.keys(d.stats.fetchErrors);
  $("#topMeta").innerHTML = `
    <span class="pill ${d.editor === "hermes" ? "ok" : "warn"}">${d.editor === "hermes" ? "✦ Biên tập bởi Hermes" : "⚙ Gom nhóm tự động"}</span>
    <span class="muted" title="${t.toLocaleString("vi-VN")}">Cập nhật ${ago(t.getTime())}</span>
    ${errs.length ? `<span class="pill warn" title="${esc(JSON.stringify(d.stats.fetchErrors))}">⚠ lỗi: ${errs.join(", ")}</span>` : ""}`;
}

function renderHero() {
  const d = digest!;
  const top = d.stories[0];
  const nSources = new Set(d.articles.map((a) => a.publisher)).size;
  $("#hero").innerHTML = `
    <div class="hero-text">
      <p class="eyebrow">${new Date(d.generatedAt).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
      <h1>${esc(d.headline)}</h1>
      <p class="overview">${esc(d.overview)}</p>
      <div class="stats">
        <div><b>${d.stories.length}</b><span>câu chuyện</span></div>
        <div><b>${Object.values(d.stats.bySource).reduce((a, b) => a + b, 0)}</b><span>bài đã đọc</span></div>
        <div><b>${nSources}</b><span>đầu báo</span></div>
        ${d.stats.hermesMs ? `<div><b>${Math.round(d.stats.hermesMs / 1000)}s</b><span>Hermes biên tập</span></div>` : ""}
      </div>
    </div>
    ${
      top
        ? `<button class="hero-feature" data-open="${esc(top.id)}" style="--c:${catOf(top.category).color}">
        <div class="art">${art(top.art, top.id)}</div>
        <div class="hero-feature-body">
          <span class="chip" style="--c:${catOf(top.category).color}">${catOf(top.category).label}</span>
          <h2>${esc(top.title)}</h2>
          <p>${esc(top.art.caption || top.summary)}</p>
        </div>
      </button>`
        : ""
    }`;
}

// ───────────────────────── bộ lọc ─────────────────────────
function renderChips() {
  const counts = new Map<string, number>();
  for (const s of digest!.stories) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const chip = (key: string, label: string, color: string, n: number) =>
    `<button class="chip filter ${ui.cat === key ? "on" : ""}" data-cat="${key}" style="--c:${color}">${label}<b>${n}</b></button>`;
  $("#chips").innerHTML =
    chip("all", "Tất cả", "#adb5bd", digest!.stories.length) +
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => chip(k, catOf(k as Category).label, catOf(k as Category).color, n))
      .join("");
}

function visibleStories(): Story[] {
  const q = ui.q.toLowerCase().normalize("NFC");
  let list = digest!.stories.filter((s) => {
    if (ui.cat !== "all" && s.category !== ui.cat) return false;
    if (!q) return true;
    return [s.title, s.summary, s.location ?? "", ...s.tags].join(" ").toLowerCase().includes(q);
  });
  const by = {
    importance: (a: Story, b: Story) => b.importance - a.importance,
    newest: (a: Story, b: Story) => storyTime(b) - storyTime(a),
    coverage: (a: Story, b: Story) => b.articleIds.length - a.articleIds.length,
    positive: (a: Story, b: Story) => b.sentiment - a.sentiment,
    negative: (a: Story, b: Story) => a.sentiment - b.sentiment,
  } as Record<string, (a: Story, b: Story) => number>;
  if (ui.sort === "custom") {
    const pos = new Map(ui.order.map((id, i) => [id, i]));
    list = list
      .map((s, i) => ({ s, i }))
      .sort((a, b) => (pos.get(a.s.id) ?? 1000 + a.i) - (pos.get(b.s.id) ?? 1000 + b.i))
      .map((x) => x.s);
  } else if (by[ui.sort]) list = [...list].sort(by[ui.sort]);
  return list;
}

// ───────────────────────── lưới câu chuyện ─────────────────────────
function cardHtml(s: Story): string {
  const c = catOf(s.category);
  const arts = storyArticles(s);
  const pubs = [...new Set(arts.map((a) => a.source))];
  const mood = moodLabel(s.sentiment);
  return `<article class="card imp-${s.importance}" data-id="${esc(s.id)}" style="--c:${c.color}" tabindex="0">
    <div class="art">${art(s.art, s.id)}
      <span class="chip" style="--c:${c.color}">${c.label}</span>
      <span class="badge" title="${arts.length} bài báo">📰 ${arts.length}</span>
    </div>
    <div class="card-body">
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.summary)}</p>
      <div class="card-meta">
        <span class="moodbar" title="${mood.t}">${mood.e}<i style="--v:${((s.sentiment + 1) / 2) * 100}%"></i></span>
        <span class="stars" title="Mức quan trọng ${s.importance}/5">${"★".repeat(s.importance)}<em>${"★".repeat(5 - s.importance)}</em></span>
        <span class="srcs">${pubs.map((p) => `<i style="background:${SOURCE_META[p]?.color}" title="${SOURCE_META[p]?.label}"></i>`).join("")}</span>
        <span class="muted">${ago(storyTime(s))}</span>
      </div>
    </div>
  </article>`;
}

let gridSortable: Sortable | null = null;
function renderGrid() {
  const list = visibleStories();
  const grid = $("#grid");
  grid.innerHTML = list.map(cardHtml).join("");
  $("#empty").hidden = list.length > 0;
  gridSortable?.destroy();
  gridSortable = Sortable.create(grid, {
    group: { name: "stories", pull: "clone", put: false },
    animation: 220,
    forceFallback: true, // kéo bằng pointer events: mượt & đồng nhất giữa chuột và cảm ứng
    fallbackOnBody: true,
    fallbackTolerance: 4,
    easing: "cubic-bezier(.2,.8,.2,1)",
    delay: 180,
    delayOnTouchOnly: true,
    ghostClass: "is-ghost",
    chosenClass: "is-chosen",
    dragClass: "is-drag",
    onEnd(evt) {
      if (evt.to !== grid) return;
      // lưu thứ tự tùy chỉnh và chuyển sang chế độ "Thứ tự của tôi"
      const ids = [...grid.querySelectorAll<HTMLElement>(".card")].map((el) => el.dataset.id!);
      const rest = ui.order.filter((id) => !ids.includes(id));
      ui.order = [...ids, ...rest];
      LS.set("order", ui.order);
      if (ui.sort !== "custom") {
        ui.sort = "custom";
        LS.set("sort", ui.sort);
        $<HTMLSelectElement>("#sort").value = "custom";
      }
    },
  });
}

// ───────────────────────── bảng theo dõi ─────────────────────────
function renderWatch() {
  const box = $("#watch");
  box.innerHTML = ui.pins
    .map(
      (p) => `<div class="pin" data-id="${esc(p.id)}" style="--c:${catOf(p.category).color}">
        <div class="pin-art">${art(p.art, p.id)}</div>
        <span class="pin-title">${esc(p.title)}</span>
        <button class="pin-x" data-unpin="${esc(p.id)}" title="Bỏ ghim">×</button>
      </div>`,
    )
    .join("");
  box.closest(".watch-panel")!.classList.toggle("has-pins", ui.pins.length > 0);
}

function pinStory(id: string, index?: number) {
  const s = storyMap.get(id);
  if (!s || ui.pins.some((p) => p.id === id)) return;
  const pin: Pin = { id, title: s.title, category: s.category, art: s.art, url: storyArticles(s)[0]?.url };
  if (index === undefined) ui.pins.push(pin);
  else ui.pins.splice(index, 0, pin);
  LS.set("pins", ui.pins);
}

Sortable.create($("#watch"), {
  group: { name: "stories", pull: false, put: true },
  animation: 200,
  forceFallback: true,
  fallbackOnBody: true,
  fallbackTolerance: 4,
  delay: 180,
  delayOnTouchOnly: true,
  ghostClass: "is-ghost",
  onAdd(evt) {
    const id = (evt.item as HTMLElement).dataset.id!;
    evt.item.remove();
    pinStory(id, evt.newIndex);
    renderWatch();
    toast("📌 Đã ghim vào Theo dõi");
  },
  onUpdate() {
    const ids = [...$("#watch").querySelectorAll<HTMLElement>(".pin")].map((el) => el.dataset.id!);
    ui.pins = ids.map((id) => ui.pins.find((p) => p.id === id)!).filter(Boolean);
    LS.set("pins", ui.pins);
  },
});

// ───────────────────────── tin nhanh ─────────────────────────
function renderTicker() {
  const list = [...digest!.articles].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 30);
  $("#tickerCount").textContent = `${list.length} tin`;
  $("#ticker").innerHTML = list
    .map(
      (a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">
        <span class="t-time">${new Date(a.publishedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
        <span class="t-title">${esc(a.title)}</span>
        <span class="t-src" style="--c:${SOURCE_META[a.source]?.color}">${esc(a.publisher.replace(" (Báo Mới)", ""))}</span>
      </a></li>`,
    )
    .join("");
}

// ───────────────────────── biểu đồ ─────────────────────────
function renderWidgets() {
  const d = digest!;
  // cảm xúc
  $("#wMood").innerHTML = moodMap(
    d.stories.map((s) => ({ id: s.id, title: s.title, sentiment: s.sentiment, importance: s.importance, size: s.articleIds.length, color: catOf(s.category).color })),
  );
  // chủ đề
  const catCount = new Map<Category, number>();
  for (const s of d.stories) catCount.set(s.category, (catCount.get(s.category) ?? 0) + s.articleIds.length);
  const catData: Datum[] = [...catCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: catOf(k).label, value: v, color: catOf(k).color }));
  $("#wCats").innerHTML = donut(catData, "bài báo");
  // nguồn
  const pubCount = new Map<string, { n: number; src: string }>();
  for (const a of d.articles) {
    const name = a.publisher.replace(" (Báo Mới)", "");
    const cur = pubCount.get(name) ?? { n: 0, src: a.source };
    cur.n++;
    pubCount.set(name, cur);
  }
  $("#wSources").innerHTML = hbars(
    [...pubCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 9).map(([k, v]) => ({ label: k, value: v.n, color: SOURCE_META[v.src]?.color ?? "#888" })),
  );
  // timeline 24h (ưu tiên histogram tính trên toàn bộ bài thu được)
  const now = new Date(d.generatedAt);
  now.setMinutes(0, 0, 0);
  const startMs = d.stats.hourly ? Date.parse(d.stats.hourly.start) : now.getTime() - 23 * 3600_000;
  const hours = Array.from({ length: 24 }, (_, i) => new Date(startMs + i * 3600_000));
  const series = Object.entries(SOURCE_META).map(([src, m]) => {
    let values = d.stats.hourly?.series[src];
    if (!values) {
      values = new Array<number>(24).fill(0);
      for (const a of d.articles) {
        const idx = Math.floor((Date.parse(a.publishedAt) - startMs) / 3600_000);
        if (a.source === src && idx >= 0 && idx < 24) values[idx]!++;
      }
    }
    return { label: m.label, color: m.color, values };
  });
  $("#wTimeline").innerHTML = timeline(series, hours.map((h) => String(h.getHours()).padStart(2, "0")));
  // từ khóa
  const kw = new Map<string, { n: number; color: string }>();
  for (const s of d.stories)
    for (const t of s.tags) {
      const k = t.trim();
      if (!k) continue;
      const cur = kw.get(k) ?? { n: 0, color: catOf(s.category).color };
      cur.n += 1 + s.importance / 5;
      kw.set(k, cur);
    }
  const words = [...kw.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 22).map(([text, v]) => ({ text, value: Math.round(v.n * 10) / 10, color: v.color }));
  $("#wKeywords").innerHTML = words.length ? bubbles(words) : `<p class="muted center">Chưa có từ khóa</p>`;
  // địa điểm
  const places = new Map<string, number>();
  for (const s of d.stories) if (s.location) places.set(s.location, (places.get(s.location) ?? 0) + 1);
  $("#wPlaces").innerHTML = places.size
    ? hbars([...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v], i) => ({ label: k, value: v, color: `hsl(${200 + i * 22} 80% 62%)` })))
    : `<p class="muted center">Chưa có dữ liệu địa điểm</p>`;
}

// thứ tự widget kéo thả
const widgets = $("#widgets");
const wOrder = LS.get<string[]>("widgets", []);
for (const key of wOrder) {
  const el = widgets.querySelector(`[data-w="${key}"]`);
  if (el) widgets.appendChild(el);
}
Sortable.create(widgets, {
  handle: ".w-head",
  animation: 220,
  forceFallback: true,
  fallbackTolerance: 4,
  ghostClass: "is-ghost",
  onEnd() {
    LS.set("widgets", [...widgets.querySelectorAll<HTMLElement>(".widget")].map((w) => w.dataset.w));
  },
});

// ───────────────────────── modal chi tiết ─────────────────────────
function openStory(id: string) {
  const s = storyMap.get(id);
  if (!s) return;
  const c = catOf(s.category);
  const arts = storyArticles(s).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const mood = moodLabel(s.sentiment);
  const pinned = ui.pins.some((p) => p.id === id);
  const modal = $<HTMLDialogElement>("#modal");
  modal.style.setProperty("--c", c.color);
  modal.innerHTML = `
    <div class="m-art">${renderArt(s.art, s.id + "-xl")}
      ${s.art.caption ? `<p class="m-caption">🎨 ${esc(s.art.caption)}</p>` : ""}
      <button class="m-close" data-close aria-label="Đóng">×</button>
    </div>
    <div class="m-body">
      <div class="m-tags">
        <span class="chip" style="--c:${c.color}">${c.label}</span>
        ${s.location ? `<span class="chip ghost">📍 ${esc(s.location)}</span>` : ""}
        <span class="chip ghost">${mood.e} ${mood.t}</span>
        <span class="chip ghost">${"★".repeat(s.importance)} quan trọng</span>
      </div>
      <h2>${esc(s.title)}</h2>
      <p class="m-summary">${esc(s.summary)}</p>
      ${s.whyItMatters ? `<div class="why"><b>💡 Vì sao đáng quan tâm</b><p>${esc(s.whyItMatters)}</p></div>` : ""}
      ${s.keyPoints.length ? `<h4>Điểm chính</h4><ol class="points">${s.keyPoints.map((k) => `<li>${esc(k)}</li>`).join("")}</ol>` : ""}
      <div class="gauge"><span>😟</span><div class="gauge-track"><i style="left:${((s.sentiment + 1) / 2) * 100}%"></i></div><span>😊</span></div>
      ${s.tags.length ? `<div class="m-kw">${s.tags.map((t) => `<button class="kw" data-search="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
      <h4>Nguồn tin (${arts.length})</h4>
      <div class="m-sources">
        ${arts
          .map(
            (a) => `<a class="src" href="${esc(a.url)}" target="_blank" rel="noopener">
            ${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"/>` : ""}
            <span><b>${esc(a.title)}</b><small style="--c:${SOURCE_META[a.source]?.color}">${esc(a.publisher)} · ${ago(Date.parse(a.publishedAt))}</small></span></a>`,
          )
          .join("")}
      </div>
      <div class="m-actions">
        <button class="btn ${pinned ? "ghost" : "primary"}" data-pin="${esc(s.id)}">${pinned ? "✓ Đang theo dõi" : "📌 Ghim theo dõi"}</button>
        <button class="btn ghost" data-share="${esc(s.id)}">🔗 Chia sẻ</button>
      </div>
    </div>`;
  modal.showModal();
  modal.scrollTop = 0;
  history.replaceState(null, "", "#" + encodeURIComponent(id));
}

// ───────────────────────── sự kiện ─────────────────────────
document.addEventListener("click", async (e) => {
  const t = e.target as HTMLElement;
  const modal = $<HTMLDialogElement>("#modal");
  if (t === modal || t.closest("[data-close]")) {
    modal.close();
    return;
  }
  const unpin = t.closest<HTMLElement>("[data-unpin]");
  if (unpin) {
    ui.pins = ui.pins.filter((p) => p.id !== unpin.dataset.unpin);
    LS.set("pins", ui.pins);
    renderWatch();
    return;
  }
  const pinBtn = t.closest<HTMLElement>("[data-pin]");
  if (pinBtn) {
    pinStory(pinBtn.dataset.pin!);
    renderWatch();
    pinBtn.textContent = "✓ Đang theo dõi";
    pinBtn.className = "btn ghost";
    return;
  }
  const share = t.closest<HTMLElement>("[data-share]");
  if (share) {
    const s = storyMap.get(share.dataset.share!);
    const url = location.origin + "/#" + encodeURIComponent(share.dataset.share!);
    if (navigator.share) navigator.share({ title: s?.title, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url);
      toast("🔗 Đã chép liên kết");
    }
    return;
  }
  const kw = t.closest<HTMLElement>("[data-search]");
  if (kw) {
    modal.close();
    setSearch(kw.dataset.search!);
    return;
  }
  const filt = t.closest<HTMLElement>("[data-filter]");
  if (filt?.dataset.filter) {
    ui.cat = filt.dataset.filter as Category;
    renderChips();
    renderGrid();
    $(".stories").scrollIntoView({ behavior: "smooth" });
    return;
  }
  const chip = t.closest<HTMLElement>("[data-cat]");
  if (chip) {
    ui.cat = chip.dataset.cat as Category | "all";
    renderChips();
    renderGrid();
    return;
  }
  const open = t.closest<HTMLElement>("[data-open], .card, .pin, .dot");
  if (open) {
    const id = open.dataset.open ?? open.dataset.id ?? open.dataset.story;
    if (id && storyMap.has(id)) openStory(id);
    else if (open.classList.contains("pin")) {
      const p = ui.pins.find((x) => x.id === id);
      if (p?.url) window.open(p.url, "_blank");
      else toast("Câu chuyện này đã cũ, không còn trong bản tin hiện tại");
    }
  }
});

document.addEventListener("keydown", (e) => {
  const card = (e.target as HTMLElement).closest?.<HTMLElement>(".card");
  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openStory(card.dataset.id!);
  }
  if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
    e.preventDefault();
    $("#search").focus();
  }
});

$<HTMLDialogElement>("#modal").addEventListener("close", () => history.replaceState(null, "", location.pathname));

function setSearch(q: string) {
  ui.q = q;
  $<HTMLInputElement>("#search").value = q;
  renderGrid();
  $(".stories").scrollIntoView({ behavior: "smooth" });
}
let searchTimer: ReturnType<typeof setTimeout>;
$<HTMLInputElement>("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    ui.q = (e.target as HTMLInputElement).value.trim();
    renderGrid();
  }, 150);
});
const sortSel = $<HTMLSelectElement>("#sort");
sortSel.value = ui.sort;
sortSel.addEventListener("change", () => {
  ui.sort = sortSel.value;
  LS.set("sort", ui.sort);
  renderGrid();
});
$("#clearWatch").addEventListener("click", () => {
  ui.pins = [];
  LS.set("pins", ui.pins);
  renderWatch();
});

// theme
const theme = LS.get<string>("theme", matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
document.documentElement.dataset.theme = theme;
$("#themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  LS.set("theme", next);
});

// tooltip cho biểu đồ
const tip = $("#tooltip");
document.addEventListener("pointermove", (e) => {
  const el = (e.target as Element).closest?.("[data-tip]") as HTMLElement | null;
  if (!el) {
    tip.hidden = true;
    return;
  }
  tip.textContent = el.dataset.tip!;
  tip.hidden = false;
  const x = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 12);
  tip.style.transform = `translate(${x}px, ${e.clientY + 14}px)`;
});

// ───────────────────────── cập nhật / tiến trình ─────────────────────────
function showProgress(on: boolean) {
  $("#progress").hidden = !on;
  $("#refreshBtn").classList.toggle("busy", on);
}

let polling = false;
async function pollStatus() {
  if (polling) return;
  polling = true;
  try {
    for (;;) {
      const st = (await (await fetch("/api/status", { cache: "no-store" })).json()) as { running: boolean; log: string[]; lastError: string | null };
      $("#progressLog").textContent = st.log.join("\n");
      if (!st.running) {
        showProgress(false);
        if (st.lastError) toast("⚠ " + st.lastError);
        else {
          await loadDigest();
          toast("✨ Đã cập nhật bản tin mới");
        }
        break;
      }
      showProgress(true);
      await new Promise((r) => setTimeout(r, 2500));
    }
  } finally {
    polling = false;
  }
}

$("#refreshBtn").addEventListener("click", async () => {
  const res = await fetch("/api/refresh", { method: "POST" });
  if (res.status === 409) toast("Đang cập nhật rồi, chờ chút nhé…");
  showProgress(true);
  pollStatus();
});

function toast(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => {
    el.classList.remove("in");
    setTimeout(() => el.remove(), 400);
  }, 2600);
}

// khởi động
await loadDigest();
fetch("/api/status")
  .then((r) => r.json())
  .then((st: { running: boolean; manualRefresh?: boolean; nextRun?: string | null }) => {
    if (st.manualRefresh === false) $("#refreshBtn").hidden = true;
    if (st.nextRun) $("#topMeta").insertAdjacentHTML("beforeend", `<span class="muted">· Bản tin kế tiếp ${new Date(st.nextRun).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>`);
    if (st.running) {
      showProgress(true);
      void pollStatus();
    }
  });
const hash = decodeURIComponent(location.hash.slice(1));
if (hash && storyMap.has(hash)) openStory(hash);
