import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'url'

// The eslint rules cannot be tested in the browser the rest of the suite runs in: `Linter` is node
// code and reaches for `process`. They are what tells a call site it has not been migrated, so they
// are worth testing -- and a second config is a smaller change than moving 93 files off the browser.
// The `./vite` entry (Sentry and source maps for the admin builds) runs Vite itself, node only too.
// `src/test/node` reads the sources from disk.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    clearMocks: true,
    environment: 'node',
    include: ['src/test/eslint/**/*.test.ts', 'src/test/vite/**/*.test.ts', 'src/test/node/**/*.test.ts'],
  },
})
