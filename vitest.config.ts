/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  // Override server config for testing to use localhost instead of custom domain
  server: {
    host: 'localhost',
    watch: {
      usePolling: true,
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],

    // Browser testing configuration (always enabled)
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
          headless: process.env.CI ? true : false, // Headless in CI, visible locally
        },
      ],
    },
  },
}))
