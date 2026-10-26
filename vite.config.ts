import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 47420,
    strictPort: true,
    allowedHosts: true,
    proxy: { '/api': 'http://127.0.0.1:47421' },
  },
  preview: {
    host: '127.0.0.1',
    port: 47420,
    strictPort: true,
    allowedHosts: true,
  },
})
