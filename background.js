// Chrome lädt background.js als MV3-Service-Worker (kein scripts-Array wie bei Firefox), daher
// hier selbst Polyfill + gmailFeed.js nachladen. In Firefox sind beide bereits über manifest.json
// als eigene background.scripts eingebunden — dieser Aufruf ist dort ein No-Op.
if (typeof browser === "undefined" && typeof importScripts === "function") {
  importScripts("browser-polyfill.min.js", "gmailFeed.js");
}

// DOMParser existiert in der Firefox-Background-Page (volles Window), aber NICHT im
// Chrome-Service-Worker. Dort wird das rohe XML stattdessen an ein Offscreen-Dokument
// delegiert, das dieselbe gmailFeed.js per <script> lädt und dort mit echtem DOM parst.
const HAS_DOM = typeof DOMParser !== "undefined";

const MAX_ACCOUNT_INDEX = 5; // mehr gleichzeitig eingeloggte Google-Konten ist unüblich
const POLL_ALARM = "poll";
const POLL_PERIOD_MINUTES = 2;

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  soundEnabled: false,
  badgeEnabled: true,
  theme: "system",
};

// ── Offscreen-Dokument (nur Chrome): Sound abspielen + XML parsen ──────────────────────────────

let offscreenReadyPromise = null;

async function ensureOffscreenDocument() {
  if (HAS_DOM) return; // Firefox braucht kein Offscreen-Dokument
  if (offscreenReadyPromise) return offscreenReadyPromise;
  offscreenReadyPromise = (async () => {
    const existing = await chrome.runtime.getContexts?.({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    if (existing && existing.length > 0) return;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK", "DOM_PARSER"],
      justification: "Benachrichtigungston abspielen und Gmail-Feed-XML parsen (kein DOM im Service Worker).",
    });
  })();
  return offscreenReadyPromise;
}

async function parseViaOffscreen(xml) {
  await ensureOffscreenDocument();
  return browser.runtime.sendMessage({ type: "parse-atom", xml });
}

async function parseFeedXml(xml) {
  if (HAS_DOM) return parseAtomXml(xml);
  return parseViaOffscreen(xml);
}

async function playSound() {
  if (HAS_DOM) {
    new Audio(browser.runtime.getURL("sound/notify.wav")).play().catch(() => {});
    return;
  }
  await ensureOffscreenDocument();
  browser.runtime.sendMessage({ type: "play-sound" }).catch(() => {});
}

// ── Feed-Fetch & Account-Zuordnung ──────────────────────────────────────────────────────────────

async function fetchAndParse(index) {
  let res;
  try {
    res = await fetch(`https://mail.google.com/mail/u/${index}/feed/atom/`, { credentials: "include" });
  } catch {
    return null; // Netzwerkfehler
  }
  if (!res.ok) return null; // kein Login an diesem Index
  const xml = await res.text();
  const parsed = await parseFeedXml(xml);
  if (!parsed) return null; // keine <feed>-Antwort (Login-HTML) oder Parsing fehlgeschlagen
  return { index, accountEmail: parsed.accountEmail, entries: parsed.entries };
}

function matchedIndexKey(email) {
  return `matchedIndex:${normalizeGmailAddress(email)}`;
}

// Session-Index (u/0, u/1, ...) ist NICHT stabil - hängt von der Login-Reihenfolge im Browser ab,
// nicht von der Konto-Adresse, und kann sich nach einem Neustart verschieben. Deshalb: zuerst den
// zuletzt bekannten Index probieren, bei Mismatch/Fehlschlag alle Indizes neu durchsuchen.
async function resolveAccount(email) {
  const target = normalizeGmailAddress(email);
  const key = matchedIndexKey(email);
  const { [key]: cachedIndex } = await browser.storage.local.get(key);

  if (cachedIndex !== undefined) {
    const probe = await fetchAndParse(cachedIndex);
    if (probe?.accountEmail && normalizeGmailAddress(probe.accountEmail) === target) {
      return probe;
    }
  }

  const indices = Array.from({ length: MAX_ACCOUNT_INDEX + 1 }, (_, i) => i);
  const probes = await Promise.all(indices.map(fetchAndParse));
  const match = probes.find((p) => p?.accountEmail && normalizeGmailAddress(p.accountEmail) === target);
  if (match) {
    await browser.storage.local.set({ [key]: match.index });
    return match;
  }
  return null; // Konto aktuell nicht in diesem Browser eingeloggt
}

// Für die Options-Seite: alle aktuell eingeloggten Konten finden, unabhängig von einer Zieladresse.
// Manche Google-Konfigurationen liefern für einen Index ohne echte eigene Session denselben Feed
// wie ein niedrigerer Index zurück (Fallback statt 401), statt einer separaten Session zu
// entsprechen - deshalb nach normalisierter Adresse deduplizieren, niedrigster Index gewinnt.
async function probeAccounts() {
  const indices = Array.from({ length: MAX_ACCOUNT_INDEX + 1 }, (_, i) => i);
  const probes = await Promise.all(indices.map(fetchAndParse));
  const seen = new Set();
  const accounts = [];
  for (const p of probes) {
    if (!p?.accountEmail) continue;
    const key = normalizeGmailAddress(p.accountEmail);
    if (seen.has(key)) continue;
    seen.add(key);
    accounts.push({ index: p.index, email: p.accountEmail });
  }
  return accounts;
}

// ── Badge ────────────────────────────────────────────────────────────────────────────────────

async function updateBadge(totalUnread, settings) {
  if (!settings.badgeEnabled || totalUnread <= 0) {
    await browser.action.setBadgeText({ text: "" });
    return;
  }
  await browser.action.setBadgeBackgroundColor({ color: "#c5221f" });
  await browser.action.setBadgeText({ text: totalUnread > 99 ? "99+" : String(totalUnread) });
}

// ── Polling ──────────────────────────────────────────────────────────────────────────────────

let pollInFlight = null;

// poll() liest seenIds am Anfang und schreibt sie erst am Ende zurück. Läuft poll() doppelt
// (z. B. Alarm + manuelles "force-poll" gleichzeitig), sehen beide Läufe denselben alten Stand
// und melden dieselbe neue Mail zweimal - daher hier auf einen einzigen laufenden Aufruf lock en.
async function poll() {
  if (pollInFlight) return pollInFlight;
  pollInFlight = doPoll().finally(() => {
    pollInFlight = null;
  });
  return pollInFlight;
}

async function doPoll() {
  const { monitoredAccounts = [], seenIds = {}, cachedFeeds = {}, ...settings } = await browser.storage.local.get({
    monitoredAccounts: [],
    seenIds: {},
    cachedFeeds: {},
    ...DEFAULT_SETTINGS,
  });

  let anyNewMail = false;
  let totalUnread = 0;
  const nextSeenIds = { ...seenIds };
  const nextCachedFeeds = { ...cachedFeeds };

  for (const account of monitoredAccounts) {
    const result = await resolveAccount(account.email);
    if (!result) continue; // Konto gerade nicht eingeloggt - überspringen, keinen Fehler werfen

    const { entries } = result;
    totalUnread += entries.length;
    nextCachedFeeds[account.email] = { entries, fetchedAt: Date.now() };

    const previousIds = seenIds[account.email];
    const currentIds = entries.map((e) => e.id);
    nextSeenIds[account.email] = currentIds;

    if (previousIds === undefined) continue; // erster Poll für dieses Konto: nur Baseline, keine Notification

    const previousIdSet = new Set(previousIds);
    const newEntries = entries.filter((e) => !previousIdSet.has(e.id));
    if (newEntries.length === 0) continue;

    anyNewMail = true;
    if (settings.notificationsEnabled) {
      const latest = newEntries[0];
      await browser.notifications.create(`new-mail:${account.email}:${Date.now()}`, {
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon128.png"),
        title: account.email,
        message:
          newEntries.length === 1
            ? `${latest.fromName || latest.fromAddress}: ${latest.subject}`
            : `${newEntries.length} new messages, latest: ${latest.subject}`,
        contextMessage: newEntries.length === 1 ? latest.subject : undefined,
      });
    }
  }

  await browser.storage.local.set({ seenIds: nextSeenIds, cachedFeeds: nextCachedFeeds });
  await updateBadge(totalUnread, settings);

  if (anyNewMail && settings.soundEnabled) {
    await playSound();
  }
}

// ── Postfach öffnen/fokussieren (Notification-Klick UND Klick auf Konto-Namen im Popup) ────────

async function openInboxTab(index) {
  const url = `https://mail.google.com/mail/u/${index}/`;
  const tabs = await browser.tabs.query({ url: "https://mail.google.com/*" });
  const existing = tabs.find((t) => t.url?.includes(`/mail/u/${index}/`));
  if (existing) {
    await browser.tabs.update(existing.id, { active: true });
    await browser.windows.update(existing.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url });
  }
}

// Nutzt den gecachten Session-Index, wenn bekannt (aus resolveAccount) - sonst wird live
// nachgesucht (z. B. Klick im Popup auf ein Konto ohne ungelesene Mail, direkt nach dem
// Hinzufügen, bevor der erste Poll durchgelaufen ist).
async function openInboxForAccount(email) {
  const key = matchedIndexKey(email);
  const { [key]: cachedIndex } = await browser.storage.local.get(key);
  if (cachedIndex !== undefined) {
    await openInboxTab(cachedIndex);
    return;
  }
  const result = await resolveAccount(email);
  if (result) {
    await openInboxTab(result.index);
  } else {
    await browser.tabs.create({ url: "https://mail.google.com/" });
  }
}

browser.notifications.onClicked.addListener(async (notificationId) => {
  const email = notificationId.split(":")[1];
  if (!email) return;
  await openInboxForAccount(email);
  await browser.notifications.clear(notificationId);
});

// ── Messages von Options/Popup ───────────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "probe-accounts") return probeAccounts();
  if (message?.type === "force-poll") return poll();
  if (message?.type === "open-inbox") return openInboxForAccount(message.email);
  return undefined;
});

// ── Alarm/Init ───────────────────────────────────────────────────────────────────────────────

async function init() {
  await browser.alarms.create(POLL_ALARM, { periodInMinutes: POLL_PERIOD_MINUTES });
  await poll();
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) poll();
});

// Kein zusätzlicher direkter init()-Aufruf hier: beim Browserstart feuert onStartup UND das
// Script würde sonst zusätzlich beim Laden init() ausführen - zwei parallele poll()-Läufe, die
// dieselbe neue Mail beide als "neu" erkennen (siehe Lock in poll()) und doppelt benachrichtigen.
browser.runtime.onInstalled.addListener(init);
browser.runtime.onStartup.addListener(init);
