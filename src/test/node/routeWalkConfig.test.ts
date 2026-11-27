import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineRouteWalkConfig } from '@/e2e/routeWalkConfig.mjs'

// The route walk's Playwright config over an admin's own (src/e2e/routeWalkConfig.mjs).

let savedBaseUrl: string | undefined
beforeEach(() => {
  savedBaseUrl = process.env.BASE_URL
  delete process.env.BASE_URL
})
afterEach(() => {
  if (savedBaseUrl === undefined) delete process.env.BASE_URL
  else process.env.BASE_URL = savedBaseUrl
})

const base = {
  globalTimeout: 210 * 60 * 1000,
  testDir: '/admin/e2e/tests',
  testIgnore: '**/tests/routes/**',
  workers: 2,
  retries: 1,
  reporter: [['html', { outputFolder: '.report' }]] as [string, object][],
  outputDir: '.results',
  globalSetup: './setup/globalSetup.ts',
  use: { viewport: { width: 1920, height: 1080 }, launchOptions: { args: ['--force-dark-mode'] } },
}

describe('defineRouteWalkConfig', () => {
  it('keeps the suite from its folders and walks the routes after the boot check', () => {
    const config = defineRouteWalkConfig({ ...base, use: { ...base.use, baseURL: 'https://cms.example' } })
    expect(config).toMatchObject({
      globalTimeout: base.globalTimeout,
      globalSetup: base.globalSetup,
      testDir: 'tests/routes',
      testIgnore: [],
      workers: 4,
      retries: 0,
      reporter: [['list'], ['html', { outputFolder: '.report-routes', open: 'never' }]],
      outputDir: '.results-routes',
      projects: [
        { name: 'boot', testMatch: /boot\.spec\.ts$/ },
        { name: 'routes', testMatch: /routes\.spec\.ts$/, dependencies: ['boot'] },
      ],
    })
    expect(config.use).toEqual({
      viewport: base.use.viewport,
      baseURL: 'https://cms.example',
      launchOptions: { args: ['--force-dark-mode'] },
    })
  })

  it('treats an http origin as secure, in full Chromium', () => {
    process.env.BASE_URL = 'http://admin-cms.sme.localhost:8150/dashboard'
    const config = defineRouteWalkConfig(base)
    expect(config.use?.channel).toBe('chromium')
    expect(config.use?.launchOptions?.args).toEqual([
      '--force-dark-mode',
      '--unsafely-treat-insecure-origin-as-secure=http://admin-cms.sme.localhost:8150',
    ])
  })

  it('keeps a secure-origin flag the admin passes itself, which may name more origins', () => {
    process.env.BASE_URL = 'http://admin-dam.sme.localhost:8151'
    const own =
      '--unsafely-treat-insecure-origin-as-secure=http://admin-dam.sme.localhost:8151,http://admin-cms.sme.localhost:8150'
    const config = defineRouteWalkConfig({ ...base, use: { ...base.use, launchOptions: { args: [own] } } })
    expect(config.use?.launchOptions?.args).toEqual([own])
  })

  it('takes overrides over its own settings, but not over the projects', () => {
    const config = defineRouteWalkConfig(base, {
      globalSetup: './routesGlobalSetup.ts',
      globalTeardown: undefined,
      globalTimeout: 60 * 60 * 1000,
      projects: [{ name: 'other' }],
      use: { baseURL: 'https://ugc.example' },
    })
    expect(config.globalSetup).toBe('./routesGlobalSetup.ts')
    expect(config.globalTimeout).toBe(60 * 60 * 1000)
    expect(config.projects?.map((project) => project.name)).toEqual(['boot', 'routes'])
    expect(config.use?.baseURL).toBe('https://ugc.example')
    expect(config.use?.viewport).toEqual(base.use.viewport)
  })
})
