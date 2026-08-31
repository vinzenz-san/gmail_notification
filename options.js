function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = browser.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
}

const accountsListEl = document.getElementById("accounts-list");
const statusEl = document.getElementById("accounts-status");

// Letztes "Konten erkennen"-Ergebnis, damit Reorder/Toggle ohne erneute Netzwerk-Anfrage neu
// rendern können. Vor dem ersten Klick leer - dann werden nur die bereits gespeicherten
// monitoredAccounts angezeigt (sonst wäre die Auswahl beim erneuten Öffnen der Seite unsichtbar).
let lastDetected = [];

// Anzeigereihenfolge: erst die überwachten Konten in der gespeicherten (persistenten) Reihenfolge,
// danach alle weiteren erkannten, noch nicht überwachten Konten.
function buildDisplayList(monitoredAccounts) {
  const monitoredEmails = monitoredAccounts.map((a) => a.email);
  const detectedByEmail = new Map(lastDetected.map((a) => [a.email, a]));
  const ordered = monitoredEmails.map((email) => detectedByEmail.get(email) ?? { email });
  for (const account of lastDetected) {
    if (!monitoredEmails.includes(account.email)) ordered.push(account);
  }
  return ordered;
}

function renderAccountRows(monitoredAccounts) {
  const monitoredEmails = monitoredAccounts.map((a) => a.email);
  const displayList = buildDisplayList(monitoredAccounts);
  accountsListEl.innerHTML = "";

  for (const account of displayList) {
    const row = document.createElement("div");
    row.className = "account-row";

    const monitoredIndex = monitoredEmails.indexOf(account.email);
    const isMonitored = monitoredIndex !== -1;

    const reorder = document.createElement("span");
    reorder.className = "reorder-buttons";
    if (isMonitored) {
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "icon-btn";
      upBtn.textContent = "↑";
      upBtn.title = browser.i18n.getMessage("optionsMoveUp");
      upBtn.disabled = monitoredIndex === 0;
      upBtn.addEventListener("click", () => moveAccount(account.email, -1));

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "icon-btn";
      downBtn.textContent = "↓";
      downBtn.title = browser.i18n.getMessage("optionsMoveDown");
      downBtn.disabled = monitoredIndex === monitoredEmails.length - 1;
      downBtn.addEventListener("click", () => moveAccount(account.email, 1));

      reorder.append(upBtn, downBtn);
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `acc-${account.email}`;
    checkbox.checked = isMonitored;
    checkbox.addEventListener("change", () => toggleAccount(account.email, checkbox.checked));

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = account.email;

    row.append(reorder, checkbox, label);
    accountsListEl.appendChild(row);
  }
}

async function toggleAccount(email, checked) {
  const { monitoredAccounts = [] } = await browser.storage.local.get({ monitoredAccounts: [] });
  const next = checked
    ? [...monitoredAccounts.filter((a) => a.email !== email), { email }]
    : monitoredAccounts.filter((a) => a.email !== email);
  await browser.storage.local.set({ monitoredAccounts: next });
  renderAccountRows(next);
  browser.runtime.sendMessage({ type: "force-poll" }).catch(() => {});
}

async function moveAccount(email, direction) {
  const { monitoredAccounts = [] } = await browser.storage.local.get({ monitoredAccounts: [] });
  const idx = monitoredAccounts.findIndex((a) => a.email === email);
  const swapWith = idx + direction;
  if (idx === -1 || swapWith < 0 || swapWith >= monitoredAccounts.length) return;
  [monitoredAccounts[idx], monitoredAccounts[swapWith]] = [monitoredAccounts[swapWith], monitoredAccounts[idx]];
  await browser.storage.local.set({ monitoredAccounts });
  renderAccountRows(monitoredAccounts);
}

async function loadSettings() {
  const state = await browser.storage.local.get({
    monitoredAccounts: [],
    notificationsEnabled: true,
    soundEnabled: false,
    badgeEnabled: true,
    theme: "system",
  });
  document.getElementById("toggle-notifications").checked = state.notificationsEnabled;
  document.getElementById("toggle-sound").checked = state.soundEnabled;
  document.getElementById("toggle-badge").checked = state.badgeEnabled;
  document.getElementById("theme-select").value = state.theme;
  renderAccountRows(state.monitoredAccounts);
}

document.getElementById("detect-btn").addEventListener("click", async () => {
  statusEl.textContent = browser.i18n.getMessage("optionsDetecting");
  try {
    lastDetected = await browser.runtime.sendMessage({ type: "probe-accounts" });
    const { monitoredAccounts = [] } = await browser.storage.local.get({ monitoredAccounts: [] });
    renderAccountRows(monitoredAccounts);
    statusEl.textContent =
      lastDetected.length > 0
        ? browser.i18n.getMessage("optionsDetectedCount", [String(lastDetected.length)])
        : browser.i18n.getMessage("optionsDetectedNone");
  } catch {
    statusEl.textContent = browser.i18n.getMessage("optionsDetectError");
  }
});

for (const [id, key] of [
  ["toggle-notifications", "notificationsEnabled"],
  ["toggle-sound", "soundEnabled"],
  ["toggle-badge", "badgeEnabled"],
]) {
  document.getElementById(id).addEventListener("change", (e) => {
    browser.storage.local.set({ [key]: e.target.checked });
  });
}

document.getElementById("theme-select").addEventListener("change", (e) => {
  browser.storage.local.set({ theme: e.target.value });
});

applyI18n();
loadSettings();
