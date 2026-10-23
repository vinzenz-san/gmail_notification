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

// Login-/Verifizierungscode aus Betreff + Feed-Snippet (der Feed liefert nur ein kurzes Summary,
// nie den Mail-Body). Bewusst konservativ: ohne Schlüsselwort wie "code"/"PIN"/"OTP" wird nichts
// erkannt, sonst würden Bestell-, Paket- und Postleitzahlen als Code durchgehen.
const CODE_KEYWORD =
  /(?:code|kode|pin|otp|passcode|passwort|kennwort|token|tan|verification|verifizierung|best[aä]tigung|confirmation|security|sicherheit)/gi;
// 4–8 Ziffern (optional 3+3 / 4+4 mit Leerzeichen oder Bindestrich) oder 6–8 Zeichen
// Großbuchstaben/Ziffern mit mind. einer Ziffer und einem Buchstaben.
const CODE_CANDIDATE = /(?<![\w-])(?:\d{3}[ -]\d{3}|\d{4}[ -]\d{4}|\d{4,8}|(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,8})(?![\w-])/g;

function extractVerificationCode(subject, preview) {
  const text = `${subject} ${preview}`;
  const keyword = new RegExp(CODE_KEYWORD.source, "i").exec(text);
  if (!keyword) return null;

  const candidates = [];
  for (const m of text.matchAll(CODE_CANDIDATE)) {
    const digitsOnly = m[0].replace(/[ -]/g, "");
    if (/^(?:19|20)\d{2}$/.test(digitsOnly)) continue; // Jahreszahl
    candidates.push({ code: digitsOnly, index: m.index });
  }
  if (candidates.length === 0) return null;

  // Bevorzugt der erste Kandidat hinter dem Schlüsselwort ("Your code is 123456"), sonst der
  // erste überhaupt ("123456 is your code").
  const after = candidates.find((c) => c.index > keyword.index);
  return (after ?? candidates[0]).code;
}

// Einstiegspunkt: rohes Feed-XML -> { accountEmail, entries }. Wirft, wenn der Titel nicht wie
// erwartet aussieht (undokumentiertes Format kann sich ändern) oder das XML kein Feed ist.
function parseAtomXml(xml) {
  if (!xml.includes("<feed")) return null;
  const accountEmail = extractFeedTitleEmail(xml);
  const entries = parseGmailAtomEntries(xml);
  return { accountEmail, entries };
}
