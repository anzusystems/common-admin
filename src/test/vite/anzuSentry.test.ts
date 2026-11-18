import { readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { anzuSentry } from '@/vite/index.mjs'
import { copyViteEntryOutsideRepository, createFixture, listFiles } from './viteFixture'

type Fixture = Awaited<ReturnType<typeof createFixture>>

const pluginNames = (plugins: unknown[]) => plugins.map((plugin) => (plugin as { name: string }).name)

function enableSentry(url = 'http://127.0.0.1:9') {
  vi.stubEnv('APP_DEPLOY_ENV', 'test')
  vi.stubEnv('SENTRY_URL', url)
  vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test')
  vi.stubEnv('GITVAR_SHORTVERSION', 'test-release')
}

// Nothing may reach a real Sentry: every build here either skips the upload or talks to a local
// server, and release creation is off.
const offline = { release: { create: false, finalize: false, setCommits: false as const } }

describe('anzuSentry', () => {
  let fixture: Fixture

  beforeAll(async () => {
    fixture = await createFixture()
  })

  afterAll(() => {
    fixture.cleanup()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is only the source map plugin when Sentry is off', () => {
    vi.stubEnv('APP_DEPLOY_ENV', '')
    vi.stubEnv('SENTRY_URL', 'https://sentry.example')
    expect(pluginNames(anzuSentry({ project: 'anzu-admin-test' }))).toEqual(['anzu:common-admin-sourcemaps'])
  })

  it('puts the source map plugin first, then the config, then Sentry', () => {
    enableSentry()
    const names = pluginNames(anzuSentry({ project: 'anzu-admin-test' }))
    expect(names.slice(0, 2)).toEqual(['anzu:common-admin-sourcemaps', 'anzu:sentry-config'])
    expect(names).toContain('sentry-vite-plugin')
  })

  it.each([
    ['SENTRY_AUTH_TOKEN', () => vi.stubEnv('SENTRY_AUTH_TOKEN', ''), { project: 'anzu-admin-test' }],
    ['project', () => {}, { project: '' }],
    ['org', () => {}, { project: 'anzu-admin-test', org: '' }],
  ])('fails when %s is empty instead of skipping the upload', (name, unset, options) => {
    enableSentry()
    unset()
    expect(() => anzuSentry(options)).toThrow(new RegExp(`${name} is empty`))
  })

  it('emits hidden maps and deletes them from the resolved outDir after the upload step', async () => {
    enableSentry()
    const outDir = await fixture.buildApp(
      anzuSentry({ project: 'anzu-admin-test', ...offline, sourcemaps: { disable: 'disable-upload' } }),
      { outDir: 'custom-out', sourcemap: false }
    )
    const files = listFiles(outDir)
    const js = files.filter((file) => file.endsWith('.js'))
    expect(js.length).toBeGreaterThan(0)
    expect(files.filter((file) => file.endsWith('.map'))).toEqual([])
    for (const file of js) {
      expect(readFileSync(join(outDir, file), 'utf8')).not.toContain('sourceMappingURL')
    }
  })

  describe('with a Sentry server that rejects the upload', () => {
    let server: Server
    let url: string

    beforeAll(async () => {
      server = createServer((_request, response) => {
        response.writeHead(401, { 'content-type': 'application/json' })
        response.end('{"detail":"Invalid token"}')
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve))
    })

    it('fails the build', async () => {
      enableSentry(url)
      const build = fixture.buildApp(anzuSentry({ project: 'anzu-admin-test', ...offline }))
      await expect(build).rejects.toThrow(/sentry/i)
    }, 60_000)
  })

  describe('without @sentry/vite-plugin installed', () => {
    let dir: string
    let entry: string

    beforeAll(() => {
      dir = copyViteEntryOutsideRepository()
      entry = pathToFileURL(join(dir, 'index.mjs')).href
    })

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    it('works while Sentry is off', async () => {
      const { anzuSentry: isolated } = await import(/* @vite-ignore */ entry)
      expect(pluginNames(isolated({ project: 'anzu-admin-test' }))).toEqual(['anzu:common-admin-sourcemaps'])
    })

    it('says what is missing once Sentry is on', async () => {
      enableSentry()
      const { anzuSentry: isolated } = await import(/* @vite-ignore */ entry)
      expect(() => isolated({ project: 'anzu-admin-test' })).toThrow(/@sentry\/vite-plugin cannot be loaded/)
    })
  })
})
