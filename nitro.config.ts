export default {
  // Use the static preset so Nitro produces a static site output (prerendered HTML)
  preset: "static",

  // Explicit output directory for Nitro; publicDir will be .output/public
  output: {
    dir: ".output",
    publicDir: "public",
  },

  // Ensure public assets are available at the root of the final public folder
  publicAssets: [
    {
      baseURL: "/",
      dir: ".output/public",
    },
  ],

  // Prerender configuration (matches the routes you previously used)
  prerender: {
    crawlLinks: true,
    routes: ["/", "/auth"],
    ignore: ["/app", "/api"],
    // don't fail the whole build on single prerender errors
    failOnError: false,
  },
};
