const framework = process.env.FRAMEWORK;

import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  let outputDir = "dist";
  if (mode === "development") {
    switch (framework) {
      case "vanilla":
        outputDir = "demo/vanilla/lib";
        break;
      case "react":
        outputDir = "demo/react/src/lib";
        break;
      case "svelte":
        outputDir = "demo/svelte/src/lib";
        break;
      case "test":
        break;
      default:
        throw new Error("Invalid FRAMEWORK_ENV");
    }
  }
  return {
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "SnapLineJs",
        filename: "snapline",
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
