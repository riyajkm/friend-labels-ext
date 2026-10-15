# Contributing

Thanks for helping! No build step: it's plain JS/CSS/HTML.

1. Fork and clone, then load the folder via `chrome://extensions` → Load unpacked.
2. Keep the core rule: **read/display only**. PRs that automate clicking, unfriending, liking or messaging will not be accepted.
3. Keep scoring logic in `lib.js` (shared by content script and dashboard).
4. Facebook DOM changes often; when fixing selectors in `content.js`, note the date and what changed.
5. No network calls, analytics or remote code.

Open an issue before large changes. Be kind.

## Branches and releases
- `main`: always stable, matches the latest release.
- `develop`: integration branch. Open PRs against `develop`.
- `feature/<name>`, `fix/<name>`: short-lived branches from `develop`.
- Release: bump `version` in `manifest.json` and `CHANGELOG.md` on `develop`, merge to `main`, then tag `vX.Y.Z`. The Release workflow builds and attaches `friend-labels.zip`.
