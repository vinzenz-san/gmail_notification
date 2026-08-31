// Wendet die manuelle Theme-Einstellung (system/light/dark) an, bevor der Body sichtbar wird, um
// Flackern zu vermeiden. Muss als allererstes <script> im <head> geladen werden (vor jedem CSS,
// das auf data-theme reagiert, ist bereits inline in theme.css als @media-Fallback vorhanden).
(async () => {
  const { theme = "system" } = await browser.storage.local.get({ theme: "system" });
  if (theme !== "system") {
    document.documentElement.dataset.theme = theme;
  }
  document.documentElement.classList.add("theme-ready");
})();
