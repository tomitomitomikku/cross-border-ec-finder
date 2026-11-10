import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isVercel = process.env.VERCEL;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        react: resolve(import.meta.dirname, 'node_modules/react'),
        'react-dom': resolve(import.meta.dirname, 'node_modules/react-dom'),
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000'
      }
    },
    build: {
      outDir: isVercel ? 'dist' : resolve(import.meta.dirname, '../extension'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(import.meta.dirname, 'popup.html'),
        },
        output: {
          entryFileNames: 'popup.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  }
})