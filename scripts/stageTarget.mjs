import { mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseManifest = JSON.parse(readFileSync(path.join(rootDir, "manifest.json"), "utf8"));

// manifest.json (source of truth) is Firefox's shape: background.scripts (array) +
// browser_specific_settings. Chrome's MV3 wants a single background.service_worker file, rejects
// the Firefox-only gecko key, and needs the "offscreen" permission (used to play sound and parse
// feed XML with DOMParser, since the service worker has no DOM - see background.js).
// background.js itself loads the polyfill + gmailFeed.js via importScripts() when it detects it's
// running as a Chrome service worker (see top of background.js).
export function manifestFor(target) {
  const manifest = structuredClone(baseManifest);
  if (target === "chrome") {
    delete manifest.browser_specific_settings;
    manifest.background = { service_worker: "background.js" };
    manifest.permissions = [...manifest.permissions, "offscreen"];
  }
  return manifest;
}

const FILES = [
  "browser-polyfill.min.js",
  "gmailFeed.js",
  "background.js",
  "offscreen.html",
  "offscreen.js",
  "theme.css",
  "theme.js",
  "popup.html",
  "popup.js",
  "options.html",
  "options.js",
];
const DIRS = ["icons", "_locales", "sound"];

// Assembles a self-contained, "Load unpacked"-ready extension folder for
// `target` ("firefox" | "chrome") at outDir.
export function stageTarget(target, outDir) {
  // Vorher komplett leeren statt nur zu überschreiben - cpSync lässt Dateien, die es in der
  // Quelle nicht mehr gibt (z. B. eine entfernte _locales/de), sonst als Leichen im Zielordner
  // liegen.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const file of FILES) {
    cpSync(path.join(rootDir, file), path.join(outDir, file));
  }
  for (const dir of DIRS) {
    cpSync(path.join(rootDir, dir), path.join(outDir, dir), { recursive: true });
  }
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifestFor(target), null, 2));
}
