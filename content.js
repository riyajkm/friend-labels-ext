// Friend Labels v3 - content script. Display + read only.
// 1. Friends page: labels every card (Keep / Review / Remove + reason + score),
//    star to protect, summary panel, "Load all", today's removal counter.
// 2. Your posts: when you open a reactions list or read comments on YOUR posts,
//    it notes which friends engaged. That raises their score.
// It never clicks Unfriend, never likes, never sends requests or messages.
(() => {
const S = {
  friends: {}, eng: {}, engSeen: {}, prot: new Set(), status: {}, day: {}, rules: {},
  filter: "all", collapsed: false, me: null, loading: false
};
const KINDS = ["Remove", "Review", "Keep"];
const COLORS = { Remove: "var(--fl-rm)", Review: "var(--fl-rv)", Keep: "var(--fl-kp)" };
const DEFAULT_AVATAR = /453178253_471506465671661|83245568_1845797888897938|t1\.30497-1/;
const ENG_SEEN_CAP = 40000;

// ---------- storage ----------
let saveT = null, dirty = new Set();
function save(...keys) {
  keys.forEach(k => dirty.add(k));
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const o = {};
    dirty.forEach(k => {
      if (k === "fl_friends") o.fl_friends = S.friends;
      if (k === "fl_eng") o.fl_eng = S.eng;
      if (k === "fl_engseen") { const ks = Object.keys(S.engSeen); if (ks.length > ENG_SEEN_CAP) ks.slice(0, ks.length - ENG_SEEN_CAP).forEach(x => delete S.engSeen[x]); o.fl_engseen = S.engSeen; }
      if (k === "fl_prot") o.fl_prot = [...S.prot];
      if (k === "fl_status") o.fl_status = S.status;
      if (k === "fl_day") o.fl_day = S.day;
      if (k === "fl_me") o.fl_me = S.me;
    });
    dirty.clear();
    chrome.storage.local.set(o);
  }, 1200);
}

// ---------- helpers ----------
function keyOfHref(href) {
  try {
    const u = new URL(href, location.origin);
    if (!/facebook\.com$/.test(u.hostname)) return null;
    if (u.pathname.startsWith("/profile.php")) { const id = u.searchParams.get("id"); return id ? "id:" + id : null; }
    const slug = u.pathname.replace(/^\//, "").replace(/\/$/, "");
    if (!slug || slug.includes("/") || /^(groups|pages|events|watch|reel|reels|marketplace|gaming|stories|photo|photos|hashtag|search|notifications|messages|friends|bookmarks|settings|help|privacy|policies|ads|business|login|home\.php|permalink\.php|story\.php|sharer)/.test(slug)) return null;
    return "u:" + slug.toLowerCase();
  } catch (e) { return null; }
}
function cleanLink(href) {
  const u = new URL(href, location.origin);
  return u.pathname.startsWith("/profile.php") ? `https://www.facebook.com/profile.php?id=${u.searchParams.get("id")}` : `https://www.facebook.com${u.pathname.replace(/\/$/, "")}`;
}
function onFriendsPage() { return /^\/[^/]+\/friends(_all)?\/?$|^\/friends\/list/.test(location.pathname) || /sk=friends/.test(location.search); }
function cardOf(a) {
  let d = a;
  for (let i = 0; i < 9 && d; i++) {
    d = d.parentElement;
    if (d && d.querySelector("img, image") && d.innerText.split("\n").filter(Boolean).length <= 6) return d;
  }
  return null;
}
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- friends page ----------
function readCard(a, card, name, key) {
  const lines = card.innerText.split("\n").map(s => s.trim()).filter(Boolean);
  const mLine = lines.find(l => /mutual friend/i.test(l)) || "";
  const mutual = mLine ? +(mLine.match(/[\d,]+/) || ["0"])[0].replace(/,/g, "") : 0;
  const img = card.querySelector("image")?.getAttribute("xlink:href") || card.querySelector("img")?.src || "";
  const photo = !!img && !DEFAULT_AVATAR.test(img) && !img.startsWith("data:");
  const info = lines.filter(l => l !== name && !/mutual friend/i.test(l) && !/^(Add friend|Message|Friends|Follow)$/i.test(l)).join(" · ").slice(0, 80);
  const prev = S.friends[key];
  const f = { key, name, link: cleanLink(a.getAttribute("href")), mutual, photo, info, deactivated: /^facebook user$/i.test(name), first: prev?.first || today(), last: today() };
  S.friends[key] = f;
  return f;
}

function tagHTML(f, a) {
  const prot = S.prot.has(f.key);
  const st = S.status[f.key];
  return `<span class="fl-pill">${st ? "Removed ✓" : a.c}</span>`
    + `<span class="fl-score" title="Score out of 100">${a.score}</span>`
    + (a.c === "Keep" && !prot ? "" : `<span class="fl-why">${esc(a.why)}</span>`)
    + a.flags.filter(x => x !== "No photo" && !a.why.toLowerCase().includes(x.toLowerCase().split(" ")[0])).map(x => `<span class="fl-flag">${esc(x)}</span>`).join("")
    + `<button class="fl-star" aria-pressed="${prot}" title="${prot ? "Protected: always Keep. Click to unprotect" : "Protect: always keep this friend"}">${prot ? "★" : "☆"}</button>`;
}

let DUPS = new Set();
function label() {
  if (!onFriendsPage()) { renderPanel(); return; }
  if (!S.me) { S.me = location.pathname.split("/")[1]; save("fl_me"); }
  document.querySelectorAll("a[href]:not([data-fl])").forEach(a => {
    a.setAttribute("data-fl", "1");
    const name = (a.innerText || "").trim();
    if (!name || name.length > 80 || /mutual friend/i.test(name)) return;
    const key = keyOfHref(a.getAttribute("href"));
    if (!key) return;
    const card = cardOf(a);
    if (!card || card.hasAttribute("data-fl-card")) return;
    const lines = card.innerText.split("\n").map(s => s.trim()).filter(Boolean);
    if (lines[0] !== name || !card.querySelector('[role="button"], [aria-label]')) return;
    const f = readCard(a, card, name, key);
    card.setAttribute("data-fl-key", key);
    let el = a;
    while (el.parentElement && el.parentElement !== card && (el.parentElement.innerText || "").trim() === name) el = el.parentElement;
    const tag = document.createElement("div");
    tag.className = "fl-tag";
    el.insertAdjacentElement("afterend", tag);
    paintCard(card, f);
  });
  save("fl_friends");
  watchRemovals();
  applyFilter();
  renderPanel();
}

function paintCard(card, f) {
  const a = FL.assess(f, S.rules, S.eng[f.key], S.prot, DUPS);
  card.setAttribute("data-fl-card", S.status[f.key] ? "Removed" : a.c);
  const tag = card.querySelector(".fl-tag");
  if (!tag) return;
  tag.className = "fl-tag fl-" + (S.status[f.key] ? "Removed" : a.c);
  tag.innerHTML = tagHTML(f, a);
  tag.title = `${a.why} · ${f.mutual} mutual · ${f.photo ? "has photo" : "no photo"} · engagement ${S.eng[f.key] || 0}`;
  tag.querySelector(".fl-star").onclick = ev => {
    ev.preventDefault(); ev.stopPropagation();
    S.prot.has(f.key) ? S.prot.delete(f.key) : S.prot.add(f.key);
    save("fl_prot"); paintCard(card, f); applyFilter(); renderPanel();
  };
}

function repaintAll() {
  DUPS = FL.dupSet(Object.values(S.friends));
  document.querySelectorAll("[data-fl-key]").forEach(card => { const f = S.friends[card.getAttribute("data-fl-key")]; if (f) paintCard(card, f); });
  applyFilter(); renderPanel();
}

// When you unfriend someone yourself, Facebook swaps their card's button to "Add friend".
function watchRemovals() {
  document.querySelectorAll("[data-fl-key]").forEach(card => {
    const key = card.getAttribute("data-fl-key");
    if (S.status[key]) return;
    const btns = [...card.querySelectorAll('[role="button"], [aria-label]')].map(b => (b.getAttribute("aria-label") || b.innerText || "").trim());
    if (btns.some(t => /^add friend$/i.test(t))) {
      S.status[key] = { s: "Removed", d: today() };
      S.day[today()] = (S.day[today()] || 0) + 1;
      save("fl_status", "fl_day");
      const f = S.friends[key]; if (f) paintCard(card, f);
      renderPanel();
    }
  });
}

function applyFilter() {
  document.querySelectorAll("[data-fl-card]").forEach(card => {
    const c = card.getAttribute("data-fl-card");
    const show = S.filter === "all" || c === S.filter || (S.filter === "Protected" && S.prot.has(card.getAttribute("data-fl-key")));
    card.classList.toggle("fl-hidden", !show);
  });
}

async function loadAll() {
  if (S.loading) { S.loading = false; renderPanel(); return; }
  S.loading = true; renderPanel();
  let stall = 0, last = 0;
  while (S.loading && stall < 12) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1600));
    label();
    const n = document.querySelectorAll("[data-fl-key]").length;
    stall = n > last ? 0 : stall + 1; last = n;
  }
  S.loading = false; window.scrollTo(0, 0); renderPanel();
}

function renderPanel() {
  let p = document.getElementById("fl-panel");
  if (!onFriendsPage()) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement("div"); p.id = "fl-panel"; document.body.appendChild(p); }
  p.classList.toggle("fl-collapsed", S.collapsed);
  const cards = [...document.querySelectorAll("[data-fl-card]")];
  const n = k => cards.filter(c => c.getAttribute("data-fl-card") === k).length;
  const total = cards.length || 1;
  const done = S.day[today()] || 0, limit = S.rules.dailyLimit || 50;
  const engaged = Object.keys(S.eng).length;
  p.innerHTML = `
    <div class="fl-head">
      <div><div class="fl-title">Friend Labels</div><div class="fl-sub">${cards.length.toLocaleString()} on this page · ${Object.keys(S.friends).length.toLocaleString()} analysed</div></div>
      <button class="fl-min" title="${S.collapsed ? "Expand" : "Collapse"}">${S.collapsed ? "+" : "–"}</button>
    </div>
    <div class="fl-body">
      <div class="fl-bar">${KINDS.map(k => `<i style="width:${(n(k) / total * 100).toFixed(2)}%;background:${COLORS[k]}"></i>`).join("")}</div>
      <div class="fl-rows">${KINDS.map(k => `<div class="fl-row" style="--c:${COLORS[k]}"><span class="k">${k}</span><span class="v">${cards.length ? Math.round(n(k) / total * 100) + "%" : ""}</span><span class="t">${n(k).toLocaleString()}</span></div>`).join("")}</div>
      <div class="fl-today ${done >= limit ? "over" : ""}"><span>Removed today</span><b>${done} / ${limit}</b><div class="fl-meter"><i style="width:${Math.min(100, done / limit * 100)}%"></i></div></div>
      <div class="fl-seg" role="group" aria-label="Show">
        ${["all", ...KINDS, "Protected"].map(f => `<button data-f="${f}" aria-pressed="${S.filter === f}">${f === "all" ? "All" : f === "Protected" ? "★" : f}</button>`).join("")}
      </div>
      <div class="fl-actions">
        <button class="fl-act primary" data-a="load">${S.loading ? "Stop loading" : "Load all friends"}</button>
        <button class="fl-act" data-a="dash">Open dashboard</button>
      </div>
      <div class="fl-tip">${done >= limit ? "You've reached today's limit. Continue tomorrow to keep your account safe." : S.loading ? "Scrolling your list… labels fill in as friends load." : `Engagement data: ${engaged} friends seen reacting or commenting on your posts.`}</div>
    </div>`;
  p.querySelector(".fl-min").onclick = () => { S.collapsed = !S.collapsed; chrome.storage.local.set({ fl_collapsed: S.collapsed }); renderPanel(); };
  p.querySelectorAll(".fl-seg button").forEach(b => b.onclick = () => { S.filter = b.dataset.f; chrome.storage.local.set({ fl_filter: S.filter }); applyFilter(); renderPanel(); });
  p.querySelector('[data-a="load"]').onclick = loadAll;
  p.querySelector('[data-a="dash"]').onclick = () => chrome.runtime.sendMessage({ type: "openDashboard" });
}

// ---------- engagement capture on your own posts ----------
function isMyPostContext(node) {
  if (!S.me) return false;
  if (location.pathname.split("/")[1] === S.me) return true;
  const art = node.closest('[role="article"]:not([aria-label^="Comment"])') || node.closest('[role="dialog"]');
  if (!art) return false;
  const first = [...art.querySelectorAll("a[href]")].map(x => keyOfHref(x.getAttribute("href"))).find(Boolean);
  return first === "u:" + S.me.toLowerCase();
}

function addEng(key, sig) {
  if (!S.friends[key] || S.engSeen[sig]) return false;
  S.engSeen[sig] = 1;
  S.eng[key] = (S.eng[key] || 0) + 1;
  return true;
}

function captureEngagement() {
  if (onFriendsPage() || !S.me) return;
  let changed = false;
  // Reactions list dialog ("All", "Like", ... tabs with a list of people)
  document.querySelectorAll('[role="dialog"]').forEach(dlg => {
    const txt = dlg.innerText.slice(0, 200);
    if (!/^(All|Reactions)|\bAll\b\s*\d/.test(txt) && !/reacted/i.test(dlg.getAttribute("aria-label") || "")) return;
    // only count reactions on your own posts: you're on your profile, or the post page is yours
    if (location.pathname.split("/")[1] !== S.me) {
      const main = document.querySelector('[role="main"] [role="article"]') || document.querySelector('[role="main"]');
      if (!main || !isMyPostContext(main.querySelector("a[href]") || main)) return;
    }
    const sigBase = "r|" + location.pathname + location.search + "|" + (dlg.getAttribute("aria-labelledby") || "") ;
    dlg.querySelectorAll("a[href]").forEach(a => {
      const k = keyOfHref(a.getAttribute("href"));
      if (k && (a.innerText || "").trim() && addEng(k, sigBase + "|" + k)) changed = true;
    });
    addScanButton(dlg);
  });
  // Comments on your posts
  document.querySelectorAll('[role="article"][aria-label^="Comment by"]:not([data-fl-c])').forEach(c => {
    c.setAttribute("data-fl-c", "1");
    if (!isMyPostContext(c.parentElement || c)) return;
    const a = c.querySelector("a[href]");
    const k = a && keyOfHref(a.getAttribute("href"));
    if (k && addEng(k, "c|" + c.getAttribute("aria-label") + "|" + k)) changed = true;
  });
  if (changed) save("fl_eng", "fl_engseen");
}

// Adds a small "Scan all reactions" button to a reactions list. It only scrolls the list.
function addScanButton(dlg) {
  if (dlg.querySelector(".fl-scan")) return;
  const b = document.createElement("button");
  b.className = "fl-scan"; b.textContent = "Friend Labels: scan all reactions";
  b.onclick = async ev => {
    ev.preventDefault();
    const box = [...dlg.querySelectorAll("div")].find(d => d.scrollHeight > d.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(d).overflowY));
    if (!box) { b.textContent = "Nothing to scroll"; return; }
    b.disabled = true; b.textContent = "Scanning…";
    let stall = 0, h = 0;
    while (stall < 6) { box.scrollTop = box.scrollHeight; await new Promise(r => setTimeout(r, 900)); captureEngagement(); stall = box.scrollHeight > h ? 0 : stall + 1; h = box.scrollHeight; }
    b.textContent = "Scan done ✓";
  };
  dlg.appendChild(b);
}

// ---------- boot ----------
chrome.storage.local.get(null, d => {
  S.friends = d.fl_friends || {};
  S.eng = d.fl_eng || {};
  S.engSeen = d.fl_engseen || {};
  S.prot = new Set(d.fl_prot || []);
  S.status = d.fl_status || {};
  S.day = d.fl_day || {};
  S.rules = Object.assign({}, FL.DEFAULT_RULES, d.fl_rules || {});
  S.filter = d.fl_filter || "all";
  S.collapsed = !!d.fl_collapsed;
  S.me = d.fl_me || null;
  DUPS = FL.dupSet(Object.values(S.friends));
  label(); captureEngagement();
});

chrome.storage.onChanged.addListener(ch => {
  let repaint = false;
  if (ch.fl_rules) { S.rules = Object.assign({}, FL.DEFAULT_RULES, ch.fl_rules.newValue || {}); repaint = true; }
  if (ch.fl_prot) { S.prot = new Set(ch.fl_prot.newValue || []); repaint = true; }
  if (ch.fl_eng) { S.eng = ch.fl_eng.newValue || {}; repaint = true; }
  if (ch.fl_status) { S.status = ch.fl_status.newValue || {}; repaint = true; }
  if (ch.fl_reset) { S.friends = {}; S.eng = {}; S.engSeen = {}; S.status = {}; S.day = {}; repaint = true; }
  if (repaint) repaintAll();
});

let t = null;
new MutationObserver(muts => {
  if (muts.every(m => { const nd = m.target.nodeType === 1 ? m.target : m.target.parentElement; return nd && nd.closest("#fl-panel, .fl-tag, .fl-scan"); })) return;
  clearTimeout(t);
  t = setTimeout(() => { label(); captureEngagement(); }, 400);
}).observe(document.documentElement, { childList: true, subtree: true });
})();
