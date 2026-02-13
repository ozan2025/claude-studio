import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
    css: {
      postcss: './postcss.config.cjs',
    },
    server: {
      watch: {
        // Ignore files outside src/ so that files edited by Claude
        // (test.md, etc.) don't trigger full page reloads.
        // Uses a function because glob negation patterns are unreliable.
        ignored: (filePath: string) => {
          // Never ignore directories — chokidar needs to traverse them
          if (!/\.\w+$/.test(filePath)) return false
          // Watch files inside src/
          if (filePath.includes('/src/')) return false
          // Watch index.html
          if (filePath.endsWith('.html')) return false
          // Ignore everything else
          return true
        },
      },
    },
  },
})
