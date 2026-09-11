import { defineConfig } from "vite";
import path from "path";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ command, mode }) => {
  return {
    resolve: {
      alias: {
        "@snap-engine/core/animation": path.resolve(root, "src/animation.ts"),
        "@snap-engine/core/collision": path.resolve(root, "src/collision.ts"),
        "@snap-engine/core/debug": path.resolve(root, "src/debug.ts"),
        "@snap-engine/core/geometry": path.resolve(root, "src/geometry.ts"),
        "@snap-engine/core/layout": path.resolve(root, "src/layout.ts"),
        "@snap-engine/core": path.resolve(root, "src/index.ts"),
        "@snap-engine/snapsort": path.resolve(
          root,
          "assets/snapsort/src",
        ),
      },
    },
    server: {
      port: 3001,
      open: false,
      strictPort: true, // Enforce port since tests rely on it
      preTransformRequests: false,
    },
  };
});
