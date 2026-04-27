import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Widget middleware: serve widget.html for /widget/* paths in dev
    {
      name: 'widget-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && /^\/widget\//.test(req.url)) {
            // Rewrite URL to serve widget.html, but keep the original path for the widget to read
            req.url = '/widget.html'
          }
          next()
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        widget: './widget.html',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
