// Shared logic for Friend Labels (content script + dashboard).
const FL = {
  DEFAULT_RULES: { removeMax: 2, noPhotoRemoveMax: 10, reviewMax: 15, dailyLimit: 50 },
  PAGE_WORDS: /\b(pvt|ltd|llc|inc|official|store|shop|music|travels?|tours?|media|studio|games?|academy|institute|campus|college|school|group|team|services?|solutions|lanka|srilanka|house|centre|center|fm|tv|news|page|club|association|traders?|enterprises?|holdings?)\b/i,

  keyOfLink(link) {
    const id = (String(link).match(/[?&]id=(\d+)/) || [])[1];
    if (id) return "id:" + id;
    return "u:" + String(link).replace(/^https?:\/\/[^/]+\//, "").split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();
  },

  // Signals for one friend -> {score 0-100, c: Keep/Review/Remove, why, flags[]}
  assess(f, rules, eng, protectedSet, dupNames) {
    const R = Object.assign({}, FL.DEFAULT_RULES, rules || {});
    const e = eng || 0;
    const flags = [];
    if (f.deactivated) flags.push("Deactivated");
    if (!f.photo) flags.push("No photo");
    if (e > 0) flags.push(`Engaged ×${e}`);
    if (dupNames && dupNames.has(f.name.toLowerCase())) flags.push("Duplicate name");
    if (FL.PAGE_WORDS.test(f.name)) flags.push("Looks like a page");

    // score: mutual friends (log scale, 0-55) + photo (15) + engagement (0-30)
    const m = Math.min(55, Math.round(Math.log10(1 + f.mutual) * 22));
    const s = Math.min(100, m + (f.photo ? 15 : 0) + Math.min(30, e * 10));
    let c, why;
    if (protectedSet && protectedSet.has(f.key)) { c = "Keep"; why = "Protected by you"; }
    else if (f.deactivated) { c = "Remove"; why = "Deactivated account"; }
    else if (e > 0) { c = "Keep"; why = `Interacts with your posts (${e})`; }
    else if (!f.photo && f.mutual <= R.noPhotoRemoveMax) { c = "Remove"; why = f.mutual ? `No photo, ${f.mutual} mutual` : "No photo, no mutual friends"; }
    else if (f.mutual === 0) { c = "Review"; why = "No mutual friends"; }
    else if (f.mutual <= R.removeMax) { c = "Remove"; why = `Only ${f.mutual} mutual`; }
    else if (f.mutual <= R.reviewMax) { c = "Review"; why = `Low mutual (${f.mutual})`; }
    else if (!f.photo) { c = "Review"; why = `No profile photo (${f.mutual} mutual)`; }
    else { c = "Keep"; why = `${f.mutual} mutual`; }
    return { score: s, c, why, flags };
  },

  dupSet(friends) {
    const n = {};
    friends.forEach(f => { const k = f.name.toLowerCase(); n[k] = (n[k] || 0) + 1; });
    return new Set(Object.keys(n).filter(k => n[k] > 1));
  },

  today() { return new Date().toISOString().slice(0, 10); },

  csv(rows) {
    const q = s => '"' + String(s ?? "").replace(/"/g, '""') + '"';
    return "﻿" + ["Name,Profile link,Mutual friends,Has profile photo,Engagement,Score,Suggestion,Reason,Flags,Protected,Status,Note,Work/school shown"]
      .concat(rows.map(r => [r.name, r.link, r.mutual, r.photo ? "Yes" : "No", r.eng || 0, r.score, r.c, r.why, (r.flags || []).join("; "), r.prot ? "Yes" : "", r.status || "", r.note || "", r.info || ""].map(q).join(","))).join("\r\n");
  }
};
if (typeof module !== "undefined") module.exports = FL;
