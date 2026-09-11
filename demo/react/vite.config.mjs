import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ command, mode }) => {
  return {
    cacheDir: path.resolve(root, "node_modules/.vite-demo-react"),
    publicDir: path.resolve(__dirname, "../../website/static"),
    plugins: [react()],
    resolve: {
      alias: {
        "@snap-engine/core/animation": path.resolve(root, "src/animation.ts"),
        "@snap-engine/core/collision": path.resolve(root, "src/collision.ts"),
        "@snap-engine/core/debug": path.resolve(root, "src/debug.ts"),
        "@snap-engine/core/geometry": path.resolve(root, "src/geometry.ts"),
        "@snap-engine/core/layout": path.resolve(root, "src/layout.ts"),
        "@snap-engine/core": path.resolve(root, "src/index.ts"),
        "@snap-engine/asset-base/react": path.resolve(
          root,
          "assets/asset-base/src/react",
        ),
        "@snap-engine/asset-base": path.resolve(
          root,
          "assets/asset-base/src",
        ),
        "@snap-engine/snapsort/react": path.resolve(
          root,
          "assets/snapsort/src/react",
        ),
        "@snap-engine/snapsort": path.resolve(root, "assets/snapsort/src"),
        "@snap-engine/snapline/react": path.resolve(
          root,
          "assets/snapline/src/react",
        ),
        "@snap-engine/snapline": path.resolve(root, "assets/snapline/src"),
      },
    },
    server: {
      port: 3001,
      open: false,
      strictPort: true,
      preTransformRequests: false,
    },
  };
});
