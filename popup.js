chrome.storage.local.get(null, d => {
  const friends = Object.values(d.fl_friends || {});
  const prot = new Set(d.fl_prot || []), eng = d.fl_eng || {}, st = d.fl_status || {};
  const dups = FL.dupSet(friends);
  const c = { Remove: 0, Review: 0, Keep: 0 };
  friends.forEach(f => { if (!st[f.key]) c[FL.assess(f, d.fl_rules, eng[f.key], prot, dups).c]++; });
  document.getElementById("rm").textContent = c.Remove.toLocaleString();
  document.getElementById("rv").textContent = c.Review.toLocaleString();
  document.getElementById("kp").textContent = c.Keep.toLocaleString();
  const limit = (d.fl_rules || {}).dailyLimit || FL.DEFAULT_RULES.dailyLimit;
  const t = (d.fl_day || {})[FL.today()] || 0;
  document.getElementById("today").textContent = friends.length
    ? `${friends.length.toLocaleString()} friends analysed · removed today ${t} / ${limit}`
    : "Open your friends page and click “Load all friends” in the panel.";
  if (d.fl_me) document.getElementById("friends").href = `https://www.facebook.com/${d.fl_me}/friends`;
});
document.getElementById("dash").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
