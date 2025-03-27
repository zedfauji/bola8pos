import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({
    // Enable Fast Refresh and JSX runtime
    jsxRuntime: 'automatic',
    babel: {
      plugins: [
        ['@babel/plugin-transform-react-jsx', {
          runtime: 'automatic'
        }]
      ]
    }
  })],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
    jsx: 'automatic'  // Enable modern JSX transform
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': '/src'  // Add path alias for cleaner imports
    }
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    open: true  // Automatically open browser
  },
  css: {
    postcss: './postcss.config.js',
    modules: {
      localsConvention: 'camelCase'  // Enable CSS modules
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'  // Force JSX parsing for .js files
      }
    }
  }
});