# Changelog

## 0.1.1 — 2026-09-06

- Fixed duplicate notifications for the same mail: `init()` was called both directly on script load and via the `onStartup` listener, so a browser start could run two overlapping `poll()` cycles that each read the same stale `seenIds` and both fired a notification. `poll()` is now guarded so only one call runs at a time.

## 0.1.0 — 2026-08-31

Initial version. Watches one or more logged-in Google accounts via Gmail's per-account Atom feed (`mail.google.com/mail/u/<n>/feed/atom/`, authenticated with the browser's own session cookies — no OAuth) and notifies on new mail.

- Multi-account detection ("Detect accounts" in Options), each toggleable independently, reorderable via ↑/↓ buttons with the order persisted to `storage.local`.
- Session index (`u/0`, `u/1`, …) resolved per account by matching the feed's own `<title>` against the configured address, re-resolved on mismatch — survives the index shifting after a browser restart. Duplicate feed responses for the same account (seen when a probed index has no real session of its own) are deduplicated by normalized address.
- Toolbar popup previews the latest unread mail per account without opening Gmail; clicking an entry opens it, clicking the account name opens/focuses its inbox tab even with nothing unread.
- Notification, sound, and toolbar unread-count badge, each independently toggleable (notification and badge on by default, sound off). A baseline poll on first run/first account never fires a notification, to avoid a flood of alerts for pre-existing unread mail.
- Single background poll (every 2 minutes via `browser.alarms`) drives everything — no per-window logic, so multiple open browser windows never produce duplicate sounds/notifications.
- Chrome support via an offscreen document (`offscreen` permission) for the two things Chrome's MV3 service worker has no DOM for: playing the notification sound and parsing feed XML with `DOMParser`. Firefox's background page does both natively.
- Light/dark/system theme (popup and options).
- Self-drawn red/white envelope icon (no Google trademark bundled) and a procedurally generated notification sound, both built with small `node:zlib`-only scripts — no image/audio assets or extra dependencies.
- Release tooling matching `defaultsorter-for-amazon`: `pnpm dev:chrome` / `dev:firefox` stage a load-unpacked folder at `dist-unpacked/<target>`, `pnpm release` packages Firefox/Chrome/source zips into `release/`. Docs site added: `docs/privacy.html`, `docs/store-listing.md`, `docs/index.html`.
