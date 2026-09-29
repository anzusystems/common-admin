import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commonAdminSourcemaps } from '@/vite/index.mjs'
import { createFixture, LIBRARY_SOURCE, listFiles } from './viteFixture'

type Fixture = Awaited<ReturnType<typeof createFixture>>

function readMap(outDir: string) {
  const mapFile = listFiles(outDir).find((file) => file.endsWith('.js.map'))
  expect(mapFile).toBeDefined()
  return JSON.parse(readFileSync(join(outDir, mapFile!), 'utf8')) as { sources: string[]; sourcesContent: string[] }
}

describe('commonAdminSourcemaps', () => {
  let fixture: Fixture

  beforeAll(async () => {
    fixture = await createFixture()
  })

  afterAll(() => {
    fixture.cleanup()
  })

  it('without the plugin the admin map ends in the library dist', async () => {
    const map = readMap(await fixture.buildApp([], { sourcemap: true }))
    expect(map.sources.some((source) => source.endsWith('dist/common-admin.js'))).toBe(true)
    expect(map.sources.some((source) => source.endsWith('src/explode.ts'))).toBe(false)
  })

  it('chains the library map, so the admin map points at the library sources with content', async () => {
    const map = readMap(await fixture.buildApp([commonAdminSourcemaps()], { sourcemap: true }))
    const index = map.sources.findIndex((source) => source.endsWith('src/explode.ts'))
    expect(index).toBeGreaterThanOrEqual(0)
    expect(map.sourcesContent[index]).toBe(LIBRARY_SOURCE)
    expect(map.sources.some((source) => source.endsWith('dist/common-admin.js'))).toBe(false)
  })

  it('leaves the emitted JS unchanged', async () => {
    const read = (outDir: string) =>
      listFiles(outDir)
        .filter((file) => file.endsWith('.js'))
        .map((file) => readFileSync(join(outDir, file), 'utf8'))
    const without = read(await fixture.buildApp([], { sourcemap: 'hidden', outDir: 'without' }))
    const withPlugin = read(await fixture.buildApp([commonAdminSourcemaps()], { sourcemap: 'hidden', outDir: 'with' }))
    expect(withPlugin).toEqual(without)
  })

  it('does nothing when the build emits no source maps', () => {
    const plugin = commonAdminSourcemaps() as any
    plugin.configResolved({ build: { sourcemap: false } })
    const id = join(fixture.root, 'node_modules/@anzusystems/common-admin/dist/common-admin.js')
    expect(plugin.load.handler(id)).toBeNull()
    plugin.configResolved({ build: { sourcemap: 'hidden' } })
    expect(plugin.load.handler(id)?.map).toContain('explode.ts')
  })

  it('only matches files of the library dist', () => {
    const { filter } = (commonAdminSourcemaps() as any).load
    expect(filter.id.test('/app/node_modules/@anzusystems/common-admin/dist/common-admin.js')).toBe(true)
    expect(filter.id.test('/app/node_modules/@anzusystems/common-admin/dist/chunks/x.mjs')).toBe(true)
    expect(filter.id.test('/app/node_modules/@anzusystems/common-admin/dist/common-admin.css')).toBe(false)
    expect(filter.id.test('/app/node_modules/@anzusystems/common-admin/dist/common-admin.js?raw')).toBe(false)
    expect(filter.id.test('/app/node_modules/@anzusystems/other/dist/index.js')).toBe(false)
    expect(filter.id.test('/app/src/dist/common-admin.js')).toBe(false)
  })
})
