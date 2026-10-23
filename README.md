# Gmail Notification

Browser extension (Firefox & Chrome) that watches one or more logged-in Google accounts and notifies you when new mail arrives — without keeping a Gmail tab open.

## Features

- **Multiple Gmail accounts at once** — detects every currently logged-in Google account in your browser and lets you pick which ones to watch.
- **Popup preview** — click the toolbar icon to see the latest unread mail per account (sender, subject) without opening Gmail; click an entry to open it directly.
- **Notification and/or sound** for new mail, each independently toggleable (sound off by default).
- **Unread count badge** on the toolbar icon, toggleable.
- **Checked every 2 minutes** via a single background poll, regardless of how many browser windows are open — no duplicate sounds/notifications.
- **Copy login codes (optional, off by default)** — when an unread mail's subject or preview contains a verification code (Twitch, GitHub, DHL, …), the popup shows a button to copy it to the clipboard. Detection runs locally on the Atom feed's short preview text.
- **Light/dark/system theme.**

No OAuth, no Google Cloud project, no password entry: it reads Gmail's per-account Atom feed (`mail.google.com/mail/u/<n>/feed/atom`) using your browser's existing session cookies — the same mechanism Gmail's own "unread count" bookmarklets have used for years. No account credentials are ever seen by the extension.

## Dev

```bash
pnpm install
```

**Load unpacked (Firefox)**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json` directly (the repo root is already Firefox-flavored).

**Load unpacked (Chrome)**: Chrome's MV3 background requires `service_worker`, which differs from Firefox's `scripts` key — the repo's `manifest.json` is Firefox-flavored, so Chrome can't load this repo directly. Instead:

```bash
pnpm dev:chrome     # or: pnpm dev:firefox
```

This stages a self-contained, Chrome-flavored (or Firefox-flavored) extension folder at `dist-unpacked/chrome` (or `dist-unpacked/firefox`) — point "Load unpacked" at that folder and re-run the script after each change.

## Release

```bash
pnpm release
```

Packages three zips into `release/` (old-version zips are kept, not deleted, so they accumulate across releases):
- `vX.Y.Z-firefox.zip` — Firefox-flavored manifest
- `vX.Y.Z-chrome.zip` — Chrome-flavored manifest (derived automatically: `background.service_worker` instead of `scripts`, plus the `offscreen` permission)
- `vX.Y.Z-source.zip` — source code bundle for AMO's review requirement (there's no build step, so this is just the repo minus `node_modules`/`release`)

## License

[MIT](LICENSE)
