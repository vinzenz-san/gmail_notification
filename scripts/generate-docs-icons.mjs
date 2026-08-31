// Favicon/Logo für die docs/-Landingpage - dieselbe Zeichnung wie die Extension-Icons
// (iconRender.mjs), nur andere Zielgrößen/Dateinamen.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderIconPng } from "./iconRender.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsIconsDir = path.join(rootDir, "docs", "icons");
mkdirSync(docsIconsDir, { recursive: true });

const targets = [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["logo.png", 128],
];

for (const [name, size] of targets) {
  const outFile = path.join(docsIconsDir, name);
  writeFileSync(outFile, renderIconPng(size));
  console.log(outFile);
}
