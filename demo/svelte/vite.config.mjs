import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig(({ command, mode }) => {
  return {
    logLevel: "info",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    plugins: [svelte()],
    server: {
      port: 3001,
      open: false,
      strictPort: true,
      preTransformRequests: false,
    },
  };
});
