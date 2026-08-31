import path from "node:path";
import { rootDir, stageTarget } from "./stageTarget.mjs";

// Assembles a "Load unpacked"-ready folder at dist-unpacked/<target> — needed for Chrome, since
// the repo's own manifest.json is Firefox-flavored (background.scripts, not service_worker).
// Re-run this after each change, then reload the extension from chrome://extensions or
// about:debugging. Firefox can also load the repo root directly; this is mainly for Chrome.
const target = process.argv[2] === "firefox" ? "firefox" : "chrome";
const outDir = path.join(rootDir, "dist-unpacked", target);

stageTarget(target, outDir);

console.log(`Staged at ${outDir}`);
console.log(
  target === "chrome"
    ? "Load unpacked: chrome://extensions -> Developer mode -> Load unpacked -> select that folder."
    : "Load Temporary Add-on: about:debugging#/runtime/this-firefox -> select dist-unpacked/firefox/manifest.json."
);
