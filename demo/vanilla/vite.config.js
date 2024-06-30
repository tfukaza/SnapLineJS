import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
    return {
        server: {
            port: 3001,
            open: true,
        },
    }
});





