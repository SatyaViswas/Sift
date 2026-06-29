import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api requests to the backend to avoid CORS in dev
    proxy: {
      '/api': {
        target: 'http://localhost:5051',
        changeOrigin: true,
      }
    }
  }
})
