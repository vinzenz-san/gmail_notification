// Parsing für Gmails undokumentierten Atom-Feed (https://mail.google.com/mail/u/<index>/feed/atom/).
// Wird in zwei Kontexten geladen: direkt in background.js (Firefox-Background-Page hat DOMParser),
// und in offscreen.html (Chrome-Service-Worker hat kein DOMParser, siehe background.js).
// Globale Funktionen statt ES-Modul, damit dieselbe Datei per <script> und per importScripts()
// funktioniert (kein Bundler in diesem Projekt).
//
// Feed-Format und Account-Erkennung 1:1 aus StartGrids GmailFeed-Widget übernommen
// (src/lib/gmailFeed.ts) — dort bereits produktiv gegen echte Gmail-Feeds verifiziert.

// Google behandelt gmail.com und die alte googlemail.com-Domain als dieselbe Mailbox, und der
// Feed-Titel kann beide Formen unabhängig von der eingegebenen Adresse melden — daher Vergleich
// nur über den Lokalteil, mit gmail.com/googlemail.com normalisiert weg.
function normalizeGmailAddress(input) {
  const trimmed = String(input).trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at === -1) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return domain === "gmail.com" || domain === "googlemail.com" ? local : trimmed;
}

// Feed-<title> hat die undokumentierte Form "Gmail - Inbox for user@example.com".
function extractFeedTitleEmail(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const title = doc.querySelector("feed > title")?.textContent?.trim() ?? "";
  return /for\s+([^\s<]+@[^\s<]+)$/i.exec(title)?.[1] ?? null;
}

function normalizeEntryDate(raw) {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parseGmailAtomEntries(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(doc.querySelectorAll("feed > entry")).map((entry) => ({
    id: entry.querySelector("id")?.textContent?.trim() || crypto.randomUUID(),
    subject: entry.querySelector("title")?.textContent?.trim() || "(no subject)",
    fromName: entry.querySelector("author > name")?.textContent?.trim() || "",
    fromAddress: entry.querySelector("author > email")?.textContent?.trim() || "",
    date:
      normalizeEntryDate(
        entry.querySelector("issued")?.textContent ?? entry.querySelector("modified")?.textContent
      ) ?? new Date().toISOString(),
    link: entry.querySelector("link")?.getAttribute("href") ?? "",
    preview: entry.querySelector("summary")?.textContent?.trim() || "",
  }));
}

// Einstiegspunkt: rohes Feed-XML -> { accountEmail, entries }. Wirft, wenn der Titel nicht wie
// erwartet aussieht (undokumentiertes Format kann sich ändern) oder das XML kein Feed ist.
function parseAtomXml(xml) {
  if (!xml.includes("<feed")) return null;
  const accountEmail = extractFeedTitleEmail(xml);
  const entries = parseGmailAtomEntries(xml);
  return { accountEmail, entries };
}
