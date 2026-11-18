import type { Article, Digest } from "../src/shared/types";
import type { VisualChapter, VisualStory } from "../src/shared/visual-types";
import { applyStep, countUp, mountGraphic } from "./graphics";
import { esc } from "./graphics/util";

const app = document.getElementById("app")!;
const id = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() ?? "");

const [vsRes, dgRes] = await Promise.all([fetch(`/api/story/${encodeURIComponent(id)}`), fetch("/api/digest")]);
if (!vsRes.ok) {
  app.innerHTML = `<div class="vb-loading">Không tìm thấy bài đồ họa này. <a href="/">Về trang chủ</a></div>`;
  throw new Error("not found");
}
const vs = (await vsRes.json()) as VisualStory;
const digest = dgRes.ok ? ((await dgRes.json()) as Digest) : null;
const articles = new Map<string, Article>((digest?.articles ?? []).map((a) => [a.id, a]));

document.title = `${vs.title} — Hermes News`;
document.getElementById("sec")!.textContent = vs.kicker;

const para = (t: string) => `<p>${esc(t)}</p>`;

function chapterHtml(ch: VisualChapter, ci: number): string {
  const head = ch.heading ? `<h2 class="ch-h">${esc(ch.heading)}</h2>` : "";
  if (!ch.graphic) return `<section class="prose">${head}${ch.steps.map((s) => para(s.text)).join("")}</section>`;
  return `${head ? `<div class="prose">${head}</div>` : ""}
<section class="scrolly" data-ch="${ci}">
  <div class="sticky"><figure class="graphic" id="g-${ci}"></figure></div>
  <div class="steps">${ch.steps.map((s, si) => `<div class="step" data-ch="${ci}" data-si="${si}"><div class="card">${para(s.text)}</div></div>`).join("")}</div>
</section>`;
}

const srcList = vs.articleIds
  .map((aid) => articles.get(aid))
  .filter(Boolean)
  .map((a) => `<li><a href="${esc(a!.url)}" target="_blank" rel="noopener">${esc(a!.title)}</a> <span>${esc(a!.publisher)}</span></li>`)
  .join("");

const others = (digest?.stories ?? []).filter((s) => s.hasVisual && s.id !== vs.storyId);

app.innerHTML = `
<section class="vb-hero">
  <figure class="graphic hero-g" id="g-hero"></figure>
  <div class="hero-text">
    <p class="kicker">${esc(vs.kicker)}</p>
    <h1>${esc(vs.title)}</h1>
    <p class="dek">${esc(vs.dek)}</p>
    ${vs.heroCaption ? `<p class="hero-cap">${esc(vs.heroCaption)}</p>` : ""}
    <p class="byline">Hermes · Ban Đồ họa — ${new Date(vs.generatedAt).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
  </div>
  <div class="scroll-cue">Cuộn để xem ↓</div>
</section>
<article class="vb-body">
  ${vs.chapters.map(chapterHtml).join("")}
  ${
    vs.factbox?.length
      ? `<section class="prose"><div class="factbox"><h3>Những con số chính</h3><dl>${vs.factbox.map((f) => `<div><dt>${esc(f.value)}</dt><dd>${esc(f.label)}</dd></div>`).join("")}</dl></div></section>`
      : ""
  }
  <section class="prose notes">
    <h3>Về dữ liệu</h3>
    ${vs.dataNotes.map((n) => `<p>- ${esc(n)}</p>`).join("")}
    <p>- Bài viết và đồ họa được Hermes Agent (AI) tổng hợp tự động từ các nguồn báo dưới đây; vui lòng đối chiếu nguồn gốc.</p>
    ${srcList ? `<h3>Nguồn</h3><ul class="srcs">${srcList}</ul>` : ""}
  </section>
  ${
    others.length
      ? `<section class="prose more"><h3>Đồ họa khác hôm nay</h3><ul>${others.map((s) => `<li><a href="/story/${encodeURIComponent(s.id)}">${esc(s.title)}</a></li>`).join("")}</ul></section>`
      : ""
  }
</article>`;

// ── nút chuyển state (vd Quy hoạch ↔ Thực tế) cho đồ họa có nhiều state ──
const label = (st: string) => vs.stateLabels?.[st] ?? st.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
function addStateToggle(el: HTMLElement): string[] {
  const states = [...new Set([...el.querySelectorAll<HTMLElement>("[data-show]")].flatMap((n) => n.dataset.show!.split(" ")))];
  if (states.length < 2) return states;
  const bar = document.createElement("div");
  bar.className = "g-states";
  bar.innerHTML = states.map((s) => `<button data-st="${esc(s)}">${esc(label(s))}</button>`).join("");
  el.prepend(bar);
  const sync = () => bar.querySelectorAll<HTMLElement>("button").forEach((b) => b.classList.toggle("on", b.dataset.st === el.dataset.state));
  bar.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-st]");
    if (!b) return;
    el.dataset.manual = "1";
    applyStep(el, { state: b.dataset.st, focus: [] });
    sync();
  });
  new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ["data-state"] });
  sync();
  return states;
}

// ── dựng đồ họa ──
const heroEl = document.getElementById("g-hero")!;
mountGraphic(heroEl, vs.hero, vs.heroState);
countUp(heroEl);
const heroStates = addStateToggle(heroEl);
// hero tự chuyển cảnh trước/sau cho tới khi người đọc bấm chọn
if (heroStates.length >= 2) {
  let i = Math.max(0, heroStates.indexOf(heroEl.dataset.state ?? ""));
  const timer = setInterval(() => {
    if (heroEl.dataset.manual) return clearInterval(timer);
    i = (i + 1) % heroStates.length;
    applyStep(heroEl, { state: heroStates[i], focus: [] });
  }, 3200);
}
vs.chapters.forEach((ch, ci) => {
  if (!ch.graphic) return;
  const el = document.getElementById(`g-${ci}`)!;
  const first = ch.steps[0];
  mountGraphic(el, ch.graphic, first?.state);
  addStateToggle(el);
});

// ── scrollytelling: bước nào ở giữa màn hình thì áp dụng focus/state của bước đó ──
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const stepEl = e.target as HTMLElement;
      const ci = Number(stepEl.dataset.ch);
      const si = Number(stepEl.dataset.si);
      const step = vs.chapters[ci]!.steps[si]!;
      const g = document.getElementById(`g-${ci}`)!;
      stepEl.parentElement!.querySelectorAll(".step").forEach((s) => s.classList.toggle("active", s === stepEl));
      applyStep(g, step);
      countUp(g);
    }
  },
  // điện thoại: đồ họa chiếm nửa trên → kích hoạt khi thẻ vào nửa dưới màn hình
  { rootMargin: matchMedia("(max-width: 900px)").matches ? "-72% 0px -18% 0px" : "-45% 0px -45% 0px" },
);
document.querySelectorAll(".step").forEach((s) => io.observe(s));

// thanh tiến độ đọc
const prog = document.getElementById("prog")!;
addEventListener(
  "scroll",
  () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = `${Math.min(100, (scrollY / Math.max(1, h)) * 100)}%`;
  },
  { passive: true },
);
