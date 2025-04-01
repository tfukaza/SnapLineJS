import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig(({ command, mode }) => {
  return {
    plugins: [svelte()],
    server: {
      port: 3001,
      open: false,
      strictPort: true,
      preTransformRequests: false,
    },
  };
});
