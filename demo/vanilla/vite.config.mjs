import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  return {
    server: {
      port: 3001,
      open: false,
      strictPort: true, // Enforce port since tests rely on it
      preTransformRequests: false,
    },
  };
});
