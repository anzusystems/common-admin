/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
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
