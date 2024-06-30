import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
    return {
        plugins: [react()],
        server: {
            port: 3000,
            open: true,
        },
    }
});





