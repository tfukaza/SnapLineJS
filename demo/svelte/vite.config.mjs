import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ command, mode }) => {
  return {
    cacheDir: path.resolve(root, "node_modules/.vite-demo-svelte"),
    logLevel: "info",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        // Core engine source
        "@snap-engine/core/animation": path.resolve(root, "src/animation.ts"),
        "@snap-engine/core/collision": path.resolve(root, "src/collision.ts"),
        "@snap-engine/core/debug": path.resolve(root, "src/debug.ts"),
        "@snap-engine/core/geometry": path.resolve(root, "src/geometry.ts"),
        "@snap-engine/core": path.resolve(root, "src/index.ts"),
        // Asset packages (raw source)
        "@snap-engine/asset-base/svelte": path.resolve(
          root,
          "assets/asset-base/src/svelte",
        ),
        "@snap-engine/asset-base": path.resolve(
          root,
          "assets/asset-base/src",
        ),
        "@snap-engine/snapsort/svelte": path.resolve(
          root,
          "assets/snapsort/src/svelte",
        ),
        "@snap-engine/snapsort": path.resolve(root, "assets/snapsort/src"),
        "@snap-engine/snapline/svelte": path.resolve(
          root,
          "assets/snapline/src/svelte",
        ),
        "@snap-engine/snapline": path.resolve(root, "assets/snapline/src"),
      },
    },
    publicDir: path.resolve(__dirname, "../../website/static"),
    plugins: [svelte()],
    server: {
      port: 3001,
      open: false,
      strictPort: true,
      preTransformRequests: false,
    },
  };
});
