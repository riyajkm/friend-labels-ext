const KINDS = ["Remove", "Review", "Keep"];
const CSS = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COL = { Remove: "--rm", Review: "--rv", Keep: "--kp" };
const PAGE = 50;
let D = {}, ROWS = [], VIEW = [], filter = "all", page = 0, q = "", sort = "score";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Number(n).toLocaleString();

function build() {
  const friends = Object.values(D.fl_friends || {});
  const prot = new Set(D.fl_prot || []);
  const eng = D.fl_eng || {}, status = D.fl_status || {}, notes = D.fl_notes || {};
  const dups = FL.dupSet(friends);
  ROWS = friends.map(f => {
    const a = FL.assess(f, D.fl_rules, eng[f.key], prot, dups);
    return Object.assign({}, f, a, { eng: eng[f.key] || 0, prot: prot.has(f.key), status: status[f.key]?.s || "", note: notes[f.key] || "" });
  });
}

function summary() {
  const n = k => ROWS.filter(r => r.c === k && !r.status).length;
  const removed = ROWS.filter(r => r.status).length;
  const limit = (D.fl_rules || {}).dailyLimit || FL.DEFAULT_RULES.dailyLimit;
  const today = (D.fl_day || {})[FL.today()] || 0;
  $("k-total").textContent = fmt(ROWS.length);
  KINDS.forEach(k => $("k-" + k).textContent = fmt(n(k)));
  $("k-prot").textContent = fmt(ROWS.filter(r => r.prot).length);
  $("k-eng").textContent = fmt(ROWS.filter(r => r.eng > 0).length);
  $("k-removed").textContent = fmt(removed);
  $("k-today").textContent = `${today} / ${limit}`;
  $("todayMeter").style.width = Math.min(100, today / limit * 100) + "%";
  $("k-today").parentElement.classList.toggle("over", today >= limit);
  $("sub").textContent = ROWS.length
    ? `${fmt(ROWS.length)} friends analysed. Last scan ${ROWS.reduce((m, r) => r.last > m ? r.last : m, "")}.`
    : "No friends analysed yet. Open your Facebook friends page and click “Load all friends” in the Friend Labels panel.";

  const active = ROWS.filter(r => !r.status), tot = active.length || 1;
  $("split").innerHTML = KINDS.map(k => `<i style="width:${n(k) / tot * 100}%;background:var(${COL[k]})" title="${k}: ${n(k)}"></i>`).join("");
  $("legend").innerHTML = KINDS.map(k => `<li><span class="dot" style="background:var(${COL[k]})"></span><span>${k}</span><span class="pct">${active.length ? Math.round(n(k) / tot * 100) + "%" : "–"}</span><span class="n">${fmt(n(k))}</span></li>`).join("");

  // mutual friends histogram
  const bins = [[0, 0, "0"], [1, 2, "1–2"], [3, 9, "3–9"], [10, 29, "10–29"], [30, 99, "30–99"], [100, 199, "100–199"], [200, 1e9, "200+"]];
  const counts = bins.map(([lo, hi]) => active.filter(r => r.mutual >= lo && r.mutual <= hi).length);
  const max = Math.max(1, ...counts), W = 420, H = 170, pad = 22, bw = (W - 10) / bins.length;
  const colorFor = i => i <= 1 ? "var(--rm)" : i <= 3 ? "var(--rv)" : "var(--kp)";
  $("hist").innerHTML = `<svg viewBox="0 0 ${W} ${H + pad}" preserveAspectRatio="xMidYMid meet">
    ${[0.5, 1].map(f => `<line class="grid-l" x1="0" x2="${W}" y1="${H - (H - 18) * f}" y2="${H - (H - 18) * f}"/>`).join("")}
    ${counts.map((c, i) => { const h = (H - 18) * c / max, x = 5 + i * bw + 6; return `<rect x="${x}" y="${H - h}" width="${bw - 12}" height="${h}" rx="4" fill="${colorFor(i)}"/><text class="val" x="${x + (bw - 12) / 2}" y="${H - h - 4}" text-anchor="middle">${c ? fmt(c) : ""}</text><text x="${x + (bw - 12) / 2}" y="${H + 15}" text-anchor="middle">${bins[i][2]}</text>`; }).join("")}
  </svg>`;

  // reasons
  const rs = {};
  active.filter(r => r.c !== "Keep").forEach(r => { const k = r.why.replace(/\(\d+\)/, "").replace(/\b\d+ mutual/, "few mutual").trim(); rs[k] = rs[k] || { n: 0, c: r.c }; rs[k].n++; });
  ROWS.forEach(r => r.flags.filter(f => /Duplicate|page/.test(f)).forEach(f => { rs[f] = rs[f] || { n: 0, c: "Review" }; rs[f].n++; }));
  const top = Object.entries(rs).sort((a, b) => b[1].n - a[1].n).slice(0, 7);
  const rmax = Math.max(1, ...top.map(t => t[1].n));
  $("reasons").innerHTML = top.length ? top.map(([k, v]) => `<li><span>${esc(k)}</span><b>${fmt(v.n)}</b><span class="bar"><i style="width:${v.n / rmax * 100}%;background:var(${COL[v.c]})"></i></span></li>`).join("") : `<li class="hint">Nothing flagged yet.</li>`;
}

function applyView() {
  const qq = q.toLowerCase();
  VIEW = ROWS.filter(r => {
    if (filter === "removed") { if (!r.status) return false; }
    else if (filter === "prot") { if (!r.prot) return false; }
    else if (filter === "eng") { if (!r.eng) return false; }
    else if (filter === "flag") { if (!r.flags.some(f => /Duplicate|page|Deactivated/.test(f))) return false; }
    else if (filter !== "all") { if (r.c !== filter || r.status) return false; }
    if (qq && !(`${r.name} ${r.why} ${r.info} ${r.flags.join(" ")} ${r.note}`.toLowerCase().includes(qq))) return false;
    return true;
  });
  const dir = sort.startsWith("-") ? -1 : 1, k = sort.replace("-", "");
  VIEW.sort((a, b) => k === "name" ? a.name.localeCompare(b.name) : ((a[k] - b[k]) * dir || a.name.localeCompare(b.name)));
  page = Math.min(page, Math.max(0, Math.ceil(VIEW.length / PAGE) - 1));
  renderRows();
}

function renderRows() {
  const slice = VIEW.slice(page * PAGE, page * PAGE + PAGE);
  $("rows").innerHTML = slice.length ? slice.map(r => {
    const sc = r.score <= 30 ? "var(--rm)" : r.score <= 50 ? "var(--rv)" : "var(--kp)";
    const lab = r.status ? "Removed" : r.c;
    return `<tr data-k="${esc(r.key)}" class="${r.status ? "is-removed" : ""}">
      <td><button class="star" aria-pressed="${r.prot}" aria-label="${r.prot ? "Unprotect" : "Protect"} ${esc(r.name)}">${r.prot ? "★" : "☆"}</button></td>
      <td class="name"><a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.name)}</a>${r.info ? `<small>${esc(r.info)}</small>` : ""}</td>
      <td class="num">${fmt(r.mutual)}</td>
      <td>${r.photo ? '<span class="photo-yes">Yes</span>' : '<span class="photo-no">No</span>'}</td>
      <td class="num">${r.eng || ""}</td>
      <td><div class="score"><span>${r.score}</span><span class="track"><i style="width:${r.score}%;background:${sc}"></i></span></div></td>
      <td><span class="pill ${lab}">${lab}</span></td>
      <td><div class="why">${esc(r.why)}</div>${r.flags.filter(f => f !== "No photo").map(f => `<span class="flag">${esc(f)}</span>`).join("")}</td>
      <td><input class="note" value="${esc(r.note)}" placeholder="Add note" aria-label="Note for ${esc(r.name)}"></td>
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="empty">${ROWS.length ? "No friends match this filter." : "Open your Facebook friends page and click “Load all friends” to start."}</td></tr>`;
  const from = VIEW.length ? page * PAGE + 1 : 0, to = Math.min(VIEW.length, (page + 1) * PAGE);
  $("count").textContent = `Showing ${fmt(from)}–${fmt(to)} of ${fmt(VIEW.length)}`;
  $("prev").disabled = page === 0;
  $("next").disabled = to >= VIEW.length;
}

// events
$("rows").addEventListener("click", e => {
  const b = e.target.closest(".star"); if (!b) return;
  const key = b.closest("tr").dataset.k;
  const prot = new Set(D.fl_prot || []);
  prot.has(key) ? prot.delete(key) : prot.add(key);
  D.fl_prot = [...prot];
  chrome.storage.local.set({ fl_prot: D.fl_prot });
  build(); summary(); applyView();
});
$("rows").addEventListener("change", e => {
  if (!e.target.classList.contains("note")) return;
  const key = e.target.closest("tr").dataset.k;
  D.fl_notes = D.fl_notes || {};
  if (e.target.value.trim()) D.fl_notes[key] = e.target.value.trim(); else delete D.fl_notes[key];
  chrome.storage.local.set({ fl_notes: D.fl_notes });
  const r = ROWS.find(x => x.key === key); if (r) r.note = e.target.value.trim();
});
$("q").addEventListener("input", e => { q = e.target.value; page = 0; applyView(); });
$("sort").addEventListener("change", e => { sort = e.target.value; applyView(); });
document.querySelectorAll(".chips button").forEach(b => b.addEventListener("click", () => {
  filter = b.dataset.f; page = 0;
  document.querySelectorAll(".chips button").forEach(x => x.setAttribute("aria-pressed", x === b));
  applyView();
}));
$("prev").onclick = () => { page = Math.max(0, page - 1); renderRows(); window.scrollTo({ top: $("rows").closest("section").offsetTop - 10 }); };
$("next").onclick = () => { page++; renderRows(); window.scrollTo({ top: $("rows").closest("section").offsetTop - 10 }); };
$("export").onclick = () => {
  const rows = [...VIEW.length ? VIEW : ROWS];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([FL.csv(rows)], { type: "text/csv;charset=utf-8" }));
  a.download = `facebook-friends-${filter}-${FL.today()}.csv`;
  a.click();
};
$("rules").addEventListener("submit", e => {
  e.preventDefault();
  const r = {};
  Object.keys(FL.DEFAULT_RULES).forEach(k => r[k] = Math.max(0, parseInt($(k).value, 10) || 0));
  D.fl_rules = r;
  chrome.storage.local.set({ fl_rules: r }, () => { $("saved").textContent = "Saved. Labels updated."; setTimeout(() => $("saved").textContent = "", 2500); });
  build(); summary(); applyView();
});
let armed = false;
$("reset").onclick = () => {
  if (!armed) { armed = true; $("reset").textContent = "Click again to clear everything"; $("resetMsg").textContent = ""; setTimeout(() => { armed = false; $("reset").textContent = "Clear all data"; }, 4000); return; }
  chrome.storage.local.remove(["fl_friends", "fl_eng", "fl_engseen", "fl_status", "fl_day", "fl_notes"], () => {
    chrome.storage.local.set({ fl_reset: Date.now() });
    $("resetMsg").textContent = "Cleared. Protected friends and rules were kept.";
    armed = false; $("reset").textContent = "Clear all data"; load();
  });
};

function load() {
  chrome.storage.local.get(null, d => {
    D = d;
    const r = Object.assign({}, FL.DEFAULT_RULES, d.fl_rules || {});
    Object.keys(FL.DEFAULT_RULES).forEach(k => $(k).value = r[k]);
    if (d.fl_me) $("openFriends").href = `https://www.facebook.com/${d.fl_me}/friends`;
    build(); summary(); applyView();
  });
}
chrome.storage.onChanged.addListener(ch => {
  if (ch.fl_friends || ch.fl_eng || ch.fl_status || ch.fl_day) { clearTimeout(window.__rl); window.__rl = setTimeout(load, 800); }
});
load();
