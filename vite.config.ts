import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(args) {
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'ssh2'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('echarts')) return 'vendor-echarts'
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
            if (id.includes('docx') || id.includes('html2canvas')) return 'vendor-export'
            if (id.includes('topojson')) return 'vendor-topojson'
          }

          if (id.includes('/src/data/world-110m.json') || id.includes('/src/core/world-map.ts')) {
            return 'map-core'
          }

          if (
            id.includes('/src/core/rule-engine.ts')
            || id.includes('/src/core/pattern-matcher.ts')
            || id.includes('/src/core/bot-detector.ts')
          ) {
            return 'analysis-core'
          }
        },
      },
    },
  },
})
