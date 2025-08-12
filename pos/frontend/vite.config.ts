// @ts-nocheck
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as pathResolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5173)
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  return {
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/components/shifts/__tests__/pinLogic.test.ts'],
    },
    resolve: {
      alias: [
        { find: /^css\.escape$/, replacement: fileURLToPath(new URL('./src/shims/css.escape.ts', import.meta.url)) },
      ],
    },
    server: {
      port,
      strictPort: true,
      hmr: {
        clientPort: port,
      },
    },
    build: {
      rollupOptions: {
        external: [
          'react',
          'react-dom',
          'react-router-dom',
          '@mui/material',
          '@mui/icons-material',
          'framer-motion',
          'notistack',
          '@emotion/react',
          '@emotion/styled'
        ]
      }
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@mui/icons-material',
        'framer-motion',
        'notistack',
        '@emotion/react',
        '@emotion/styled'
      ]
    }
  }
})
