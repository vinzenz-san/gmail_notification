// Extension-Icons (16/32/48/128px). Zeichenlogik in iconRender.mjs, geteilt mit
// generate-docs-icons.mjs.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderIconPng } from "./iconRender.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(rootDir, "icons");
mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const outFile = path.join(iconsDir, `icon${size}.png`);
  writeFileSync(outFile, renderIconPng(size));
  console.log(outFile);
}
