const framework = process.env.FRAMEWORK;

import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig(({ command, mode }) => {
  let outputDir = "dist";
  if (mode === "development") {
    switch (framework) {
      case "vanilla":
        outputDir = "demo/vanilla/snapengine";
        break;
      case "react":
        outputDir = "demo/react/src/snapengine";
        break;
      case "svelte":
        outputDir = "demo/svelte/src/snapengine";
        break;
      case "test":
        break;
      default:
        throw new Error("Invalid FRAMEWORK_ENV");
    }
  }

  const plugins = [];
  if (mode === "production") {
    plugins.push(
      dts({
        include: ["src"],
        exclude: [
          "src/asset/node_ui/**",
          "src/asset/background.ts",
          "src/asset/drag_and_drop/**",
        ],
        rollupTypes: true,
      })
    );
  }

  return {
    logLevel: "info",
    plugins,
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      lib: {
        entry: {
          snapengine: resolve(__dirname, "src/index.ts"),
          debug: resolve(__dirname, "src/debug.ts"),
          animation: resolve(__dirname, "src/animation.ts"),
          collision: resolve(__dirname, "src/collision.ts"),
          geometry: resolve(__dirname, "src/geometry.ts"),
        },
        name: "SnapEngine",
        formats: ["es"],
        fileName: (format, entryName) => `${entryName}.mjs`,
      },
      outDir: outputDir,
      minify: mode === "production" ? "terser" : false,
      terserOptions: {
        toplevel: true,
        mangle: {
          properties: {
            regex: /^(_|#)/,
          },
        },
        module: true,
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
  };
});
