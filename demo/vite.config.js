import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'


// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    return {
      base:'/SnapLineJS/',
      plugins: [svelte()]
    }
  } else {
    return {plugins: [svelte()]};
  }
  
})
