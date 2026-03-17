import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Use explicit IPv4 to avoid localhost resolving to multiple addresses.
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
      },
    },
  },
})
