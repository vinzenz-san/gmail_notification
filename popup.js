function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = browser.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const msg = browser.i18n.getMessage(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });
}

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

const accountsEl = document.getElementById("accounts");
const emptyEl = document.getElementById("empty");

function makeCopyButton(code) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy-code";
  btn.textContent = browser.i18n.getMessage("popupCopyCode", [code]);
  btn.title = browser.i18n.getMessage("popupCopyCodeTitle");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = browser.i18n.getMessage("popupCopied");
    } catch {
      btn.textContent = browser.i18n.getMessage("popupCopyFailed");
    }
    setTimeout(() => {
      btn.textContent = browser.i18n.getMessage("popupCopyCode", [code]);
    }, 1500);
  });
  return btn;
}

function renderAccounts(monitoredAccounts, cachedFeeds, copyCodeEnabled) {
  accountsEl.innerHTML = "";

  if (monitoredAccounts.length === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = browser.i18n.getMessage("popupNoAccounts");
    return;
  }
  emptyEl.hidden = true;

  for (const account of monitoredAccounts) {
    const entries = cachedFeeds[account.email]?.entries ?? [];

    const section = document.createElement("section");
    section.className = "account";

    const heading = document.createElement("h2");
    heading.textContent = account.email;
    heading.title = browser.i18n.getMessage("popupOpenInbox");
    heading.addEventListener("click", () => {
      browser.runtime.sendMessage({ type: "open-inbox", email: account.email });
    });
    section.appendChild(heading);

    if (entries.length === 0) {
      const hint = document.createElement("p");
      hint.className = "empty-hint";
      hint.textContent = browser.i18n.getMessage("popupNoUnread");
      section.appendChild(hint);
    } else {
      const list = document.createElement("ul");
      for (const entry of entries.slice(0, 8)) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = entry.link || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const from = document.createElement("span");
        from.className = "from";
        from.textContent = entry.fromName || entry.fromAddress || "?";

        const subject = document.createElement("span");
        subject.className = "subject";
        subject.textContent = truncate(entry.subject, 64);

        link.append(from, subject);
        item.appendChild(link);
        const code = copyCodeEnabled ? extractVerificationCode(entry.subject, entry.preview) : null;
        if (code) item.appendChild(makeCopyButton(code));
        list.appendChild(item);
      }
      section.appendChild(list);
    }

    accountsEl.appendChild(section);
  }
}

async function readState() {
  return browser.storage.local.get({ monitoredAccounts: [], cachedFeeds: {}, copyCodeEnabled: false });
}

async function load() {
  applyI18n();
  const { monitoredAccounts, cachedFeeds, copyCodeEnabled } = await readState();
  renderAccounts(monitoredAccounts, cachedFeeds, copyCodeEnabled);

  try {
    await browser.runtime.sendMessage({ type: "force-poll" });
    const fresh = await readState();
    renderAccounts(fresh.monitoredAccounts, fresh.cachedFeeds, fresh.copyCodeEnabled);
  } catch {
    // Hintergrundskript nicht erreichbar (z. B. gerade neu gestartet) - gecachte Ansicht bleibt stehen.
  }
}

document.getElementById("settings-btn").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

load();
