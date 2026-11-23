import { spawn } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

/** Starts the backend API with the dev server and stops it when the dev server stops, so /api never goes dark. */
function apiServer(): Plugin {
  return {
    name: 'api-server',
    apply: 'serve',
    configureServer(server) {
      const child = spawn('bun', ['run', 'server/index.ts'], { stdio: 'inherit' })
      const stop = () => child.kill()
      server.httpServer?.on('close', stop)
      process.on('exit', stop)
    },
  }
}

export default defineConfig({
  plugins: [react(), nodePolyfills(), apiServer()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'wagmi',
      'wagmi/chains',
      'wagmi/connectors',
      'viem',
      'viem/chains',
      'connectkit',
      'framer-motion',
      'lucide-react',
      'sonner',
      'clsx',
      'tailwind-merge',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
    ],
  },
  server: {
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
