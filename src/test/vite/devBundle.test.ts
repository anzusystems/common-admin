import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `yarn dev:admin` builds the library as one bundle for the admins' dev servers. Unbundled, its ~800
// modules on top of an admin's own made every third page reload fail in Chrome
// (ERR_INSUFFICIENT_RESOURCES); the published build keeps one file per module.

const outputOf = async () => {
  vi.resetModules()
  // Through a variable: the test program would otherwise type-check the config and its `.mts` imports.
  const path = resolve('vite.config.lib.mts')
  const { default: config } = await import(/* @vite-ignore */ path)
  return (config as { build: { rolldownOptions: { output: { preserveModules: boolean } } } }).build.rolldownOptions
    .output
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the library build', () => {
  it('keeps one file per module for the published package', async () => {
    vi.stubEnv('COMMON_ADMIN_DEV_BUNDLE', '')
    expect((await outputOf()).preserveModules).toBe(true)
  })

  it('bundles for `yarn dev:admin`', async () => {
    const scripts = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).scripts as Record<string, string>
    expect(scripts['dev:admin']).toContain('COMMON_ADMIN_DEV_BUNDLE=1')
    vi.stubEnv('COMMON_ADMIN_DEV_BUNDLE', '1')
    expect((await outputOf()).preserveModules).toBe(false)
  })
})
