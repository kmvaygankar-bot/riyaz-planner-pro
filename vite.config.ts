// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools, tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only, cloudflare preset), VITE_* env injection, etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "./",
    build: {
      sourcemap: false,
      // Emit a manifest so the post-build step can locate the client entry
      // chunk and CSS deterministically when synthesizing the Capacitor
      // index.html.
      manifest: true,
    },
  },
});
