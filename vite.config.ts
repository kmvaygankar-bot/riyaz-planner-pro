// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "./",
    build: {
      outDir: ".output/public",
      emptyOutDir: true,
      assetsDir: "assets",
      sourcemap: false
    }
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    // Ensure client-side static files are generated alongside server output
    publicAssets: [
      {
        baseURL: "/",
        dir: ".output/public",
      },
    ],
    // Pre-render routes to generate static HTML for Capacitor
    prerender: {
      crawlLinks: true,
      routes: ["/", "/auth"],
      ignore: ["/app", "/api"],
      // don't fail the whole build on single prerender errors
      failOnError: false,
    },
  },
});
