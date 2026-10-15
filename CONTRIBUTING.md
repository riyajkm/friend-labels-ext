# Contributing

Thanks for helping! No build step: it's plain JS/CSS/HTML.

1. Fork and clone, then load the folder via `chrome://extensions` → Load unpacked.
2. Keep the core rule: **read/display only**. PRs that automate clicking, unfriending, liking or messaging will not be accepted.
3. Keep scoring logic in `lib.js` (shared by content script and dashboard).
4. Facebook DOM changes often; when fixing selectors in `content.js`, note the date and what changed.
5. No network calls, analytics or remote code.

Open an issue before large changes. Be kind.
