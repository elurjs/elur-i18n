import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: "dist/lib",
    sourcemap: true,
    lib: {
      entry: {
        "elur-i18n": resolve("src/index.ts"),
        "format/date": resolve("src/format/date.ts"),
        "format/number": resolve("src/format/number.ts"),
        "format/currency": resolve("src/format/currency.ts"),
        "format/relativeTime": resolve("src/format/relativeTime.ts"),
        "format/list": resolve("src/format/list.ts"),
        "format/index": resolve("src/format/index.ts"),
        "backends/object": resolve("src/backends/object.ts"),
        "backends/json": resolve("src/backends/json.ts"),
        "backends/api": resolve("src/backends/api.ts"),
        "plugins/persist": resolve("src/plugins/persist.ts"),
        "plugins/detect": resolve("src/plugins/detect.ts"),
        "plugins/router": resolve("src/plugins/router.ts"),
        "plugins/forms": resolve("src/plugins/forms.ts"),
        "plugins/sync": resolve("src/plugins/sync.ts"),
        "plugins/head": resolve("src/plugins/head.ts"),
        "plugins/icuPluralize": resolve("src/plugins/icuPluralize.ts"),
        "plugins/devOverlay": resolve("src/plugins/devOverlay.ts"),
        "cli/extract": resolve("src/cli/extract.ts"),
        "cli/generate": resolve("src/cli/generate.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "cjs" ? "cjs" : "js"}`,
    },
    rollupOptions: {
      external: ["@elurjs/core", "@babel/parser"],
      output: {
        preserveModules: false,
        globals: {
          "@elurjs/core": "ElurJs",
        },
      },
    },
  },
});
