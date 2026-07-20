#!/usr/bin/env node
// Post-build step: assemble `.output/public/` for Capacitor.
//
// TanStack Start's default build targets Cloudflare (SSR) and emits the
// client bundle to `dist/client/`. Capacitor needs a static folder with a
// bootable `index.html`. This script:
//   1. Copies `dist/client/*` to `.output/public/`
//   2. Synthesizes an SPA `index.html` that loads the client entry chunk
//      + emitted CSS so `bunx cap sync android` can package the app.
//
// The web/SSR deploy path (dist/server) is untouched.

import { cp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const clientDir = join(root, "dist", "client");
const outDir = join(root, ".output", "public");

if (!existsSync(clientDir)) {
  console.error(`[capacitor-static] Missing ${clientDir}. Run \`vite build\` first.`);
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(clientDir, outDir, { recursive: true });

// Locate entry JS + CSS from the Vite manifest when available, otherwise fall
// back to filename patterns.
const assetsDir = join(outDir, "assets");
const assets = existsSync(assetsDir) ? await readdir(assetsDir) : [];

let entryJs;
let entryCss;

const manifestPath = join(outDir, ".vite", "manifest.json");
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const entry = Object.values(manifest).find((e) => e && e.isEntry);
    if (entry?.file) entryJs = entry.file;
    if (entry?.css?.[0]) entryCss = entry.css[0];
  } catch {}
}

entryJs ||= (() => {
  const c = assets.find((f) => /^index-.*\.js$/.test(f));
  return c ? `assets/${c}` : undefined;
})();
entryCss ||= (() => {
  const c = assets.find((f) => /^styles-.*\.css$/.test(f)) ||
            assets.find((f) => f.endsWith(".css"));
  return c ? `assets/${c}` : undefined;
})();

if (!entryJs) {
  console.error("[capacitor-static] Could not find a client entry chunk in dist/client/assets.");
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Riyaz</title>
    <link rel="icon" href="./favicon.ico" />
    ${entryCss ? `<link rel="stylesheet" href="./${entryCss}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./${entryJs}"></script>
  </body>
</html>
`;

await writeFile(join(outDir, "index.html"), html, "utf8");
console.log(`[capacitor-static] Wrote ${join(outDir, "index.html")}`);
console.log(`[capacitor-static] Entry: ${entryJs}${entryCss ? `, CSS: ${entryCss}` : ""}`);
