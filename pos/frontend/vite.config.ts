/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as pathResolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5173)
  const isTest = mode === 'test'
  
  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.js'],
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**', '**/cypress/**'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          '**/*.d.ts',
          '**/*.stories.{js,jsx,ts,tsx}',
          '**/test-utils/**',
          '**/__mocks__/**',
          '**/types/**',
          '**/constants/**',
          '**/vite-env.d.ts'
        ]
      },
      environmentOptions: {
        jsdom: {
          url: 'http://localhost:5173'
        }
      },
      // Use the tsconfig for tests
      tsConfig: './tsconfig.vitest.json'
    },
    resolve: {
      alias: [
        { find: /^css\.escape$/, replacement: fileURLToPath(new URL('./src/shims/css.escape.ts', import.meta.url)) },
        // Test utilities
        {
          find: /^\@\/test-utils(\/.*)?$/,
          replacement: pathResolve(__dirname, 'test-utils$1')
        },
        // Source directory alias - updated for better module resolution
        {
          find: /^\@\/(.*)$/,
          replacement: pathResolve(__dirname, './src/$1')
        },
        // Additional aliases for better module resolution
        {
          find: '@/components',
          replacement: pathResolve(__dirname, './src/components')
        },
        {
          find: '@/lib',
          replacement: pathResolve(__dirname, './src/lib')
        }
      ]
    },
    server: {
      port,
      strictPort: true,
      hmr: {
        clientPort: port,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false, // Ignore self-signed certificate errors
          rewrite: (path) => path
        }
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
        '@emotion/styled',
        'date-fns'
      ]
    },
    define: {
      // Fix for date-fns in test environment
      ...(isTest ? { 'process.env.NODE_ENV': '"test"' } : {})
    }
  }
})
