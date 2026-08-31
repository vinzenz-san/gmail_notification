# Store listing reference

Copy-paste source for the Chrome Web Store / Firefox AMO submission forms.

## Short description (Chrome: max 132 characters)

Get notified when new mail arrives in your logged-in Gmail accounts — popup preview, sound, and toolbar badge.

## Full description

**Gmail Notification** watches one or more Google accounts you're already logged into in your browser and tells you when new mail arrives — without keeping a Gmail tab open.

- **Multiple Gmail accounts at once** — detects every currently logged-in Google account and lets you pick which ones to watch, reorderable.
- **Popup preview** — click the toolbar icon to see the latest unread mail per account (sender, subject) and open it directly; click an account's name to open its inbox even with nothing unread.
- **Notification, sound, and toolbar badge** — each independently toggleable, sound off by default.
- **Checked every 2 minutes**, one background check for the whole browser so multiple open windows never trigger duplicate sounds.
- **Light/dark/system theme.**
- **No OAuth, no Google Cloud project, no password ever entered or seen.** Uses your browser's existing Gmail session. Nothing leaves your device.

This is an independent, unofficial project — not affiliated with or endorsed by Google.

## Full description (plain text — paste as-is)

Chrome's description field doesn't render Markdown: pasting the section above literally shows the `**` characters and no clickable links. This is the same content converted to plain text.

```
Gmail Notification watches one or more Google accounts you're already logged into in your browser and tells you when new mail arrives — without keeping a Gmail tab open.

- Multiple Gmail accounts at once — detects every currently logged-in Google account and lets you pick which ones to watch, reorderable.
- Popup preview — click the toolbar icon to see the latest unread mail per account (sender, subject) and open it directly; click an account's name to open its inbox even with nothing unread.
- Notification, sound, and toolbar badge — each independently toggleable, sound off by default.
- Checked every 2 minutes, one background check for the whole browser so multiple open windows never trigger duplicate sounds.
- Light/dark/system theme.
- No OAuth, no Google Cloud project, no password ever entered or seen. Uses your browser's existing Gmail session. Nothing leaves your device.

This is an independent, unofficial project — not affiliated with or endorsed by Google.
```

## Category

Productivity (Chrome) — **Alerts & Updates** / "Hinweise und Benachrichtigungen" (Firefox AMO; single best fit, no need to fill all 3 slots)

## License

MIT (matches the repo's `LICENSE` file).

## Permission justifications (for review forms)

**`storage`**
> Saves which accounts to watch (and their order), the notification/sound/badge/theme settings, and a short-lived cache of each account's unread mail (via `browser.storage.local`). No user data is transmitted anywhere.

**`alarms`**
> Schedules the recurring 2-minute background check for new mail, without needing a page or tab kept open.

**`notifications`**
> Shows a system notification when new mail arrives, if enabled. Clicking it opens the corresponding account's inbox.

**`offscreen`** (Chrome only)
> Chrome's MV3 background service worker has no DOM. This permission creates a hidden page solely to play a notification sound and parse feed XML with `DOMParser` — never shown to the user, never navigates anywhere.

**Host permissions: `mail.google.com`**
> Fetches each watched account's own unread-mail feed using the user's existing browser session (the same mechanism unread-count bookmarklets have used for years — no OAuth). The extension does not run on, read, or modify any other site.

**Single purpose (Chrome requires a one-line summary)**
> Notifies the user of new mail in their logged-in Gmail accounts, with a popup preview, sound, and toolbar badge.

## Privacy policy URL

`https://vinzenz-dev.de/gmail_notification/privacy.html`

## Screenshots needed

Not yet captured. At minimum:
1. The toolbar popup showing the unread-mail preview across two accounts.
2. The options page with an account list, showing the reorder controls and toggles.
3. A system notification for new mail.

(1280×800 or 640×400 for Chrome; Firefox AMO accepts most reasonable sizes.)
