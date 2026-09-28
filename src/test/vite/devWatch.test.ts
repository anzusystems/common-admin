import { execFileSync } from 'node:child_process'
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { commonAdminDevWatch } from '@/vite/index.mjs'

const PACKAGE = '@anzusystems/common-admin'
const roots: string[] = []
const tempRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'anzu-devwatch-'))
  roots.push(root)
  return root
}
afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

type Handler = (file: string) => void

// Just enough of a Vite dev server for the plugin's `configureServer`.
function fakeServer(root: string, excluded: boolean) {
  const handlers = new Map<string, Handler[]>()
  const invalidated: string[] = []
  const server = {
    config: {
      root,
      logger: { info: vi.fn() },
      optimizeDeps: { exclude: excluded ? [PACKAGE] : [] },
    },
    middlewares: { use: vi.fn() },
    watcher: {
      add: vi.fn(),
      on: (event: string, handler: Handler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
    },
    restart: vi.fn(() => Promise.resolve()),
    environments: {
      client: {
        moduleGraph: {
          getModulesByFile: (file: string) => new Set([{ file }]),
          invalidateModule: (mod: { file: string }) => invalidated.push(mod.file),
        },
        hot: { send: vi.fn() },
      },
    },
  }
  const trigger = (content: string) => {
    writeFileSync(join(root, '.common-admin-updated'), content)
    handlers.get('change')?.forEach((handler) => handler(resolve(root, '.common-admin-updated')))
  }
  return { server, trigger, invalidated }
}

const configureServer = (plugin: ReturnType<typeof commonAdminDevWatch>, server: unknown) =>
  (plugin.configureServer as (server: unknown) => void)(server)

describe('commonAdminDevWatch', () => {
  it('pre-bundled (the default): any update restarts the server with a re-optimization', () => {
    const root = tempRoot()
    const { server, trigger } = fakeServer(root, false)
    configureServer(commonAdminDevWatch(), server)
    trigger('components/AFoo.js\n')
    expect(server.restart).toHaveBeenCalledWith(true)
  })

  it('not pre-bundled: leaves the library out of the optimizer and pre-bundles every package it imports', () => {
    const root = tempRoot()
    const dist = join(root, 'node_modules', PACKAGE, 'dist')
    mkdirSync(join(dist, 'components'), { recursive: true })
    writeFileSync(
      join(dist, 'components/AMenu.js'),
      "import { VMenu } from 'vuetify/components/VMenu'\nimport dayjs from 'dayjs'\nimport './AMenu.css'\nimport { x } from '../common.js'\nconst l = () => import('rusha')\n"
    )
    writeFileSync(
      join(dist, 'common.js'),
      "export { useI18n } from 'vue-i18n'\nconst m = { s: \"see from ' ), there\" }\n"
    )
    const plugin = commonAdminDevWatch({ prebundle: false })
    const config = { root, optimizeDeps: { include: ['vue', PACKAGE] } }
    const extra = (plugin.config as (config: unknown) => { optimizeDeps: { exclude: string[]; include: string[] } })(
      config
    )
    expect(config.optimizeDeps.include).toEqual(['vue'])
    expect(extra.optimizeDeps.exclude).toEqual([PACKAGE])
    expect(extra.optimizeDeps.include).toEqual(
      ['dayjs', 'rusha', 'vue-i18n', 'vuetify/components/VMenu'].map((id) => `${PACKAGE} > ${id}`)
    )
  })

  it('not pre-bundled: invalidates the listed files and reloads the page, without a restart', () => {
    const root = tempRoot()
    const { server, trigger, invalidated } = fakeServer(root, true)
    configureServer(commonAdminDevWatch({ prebundle: false }), server)
    trigger('components/AFoo.js\ncommon-admin.css\n')
    expect(server.restart).not.toHaveBeenCalled()
    const dist = join(root, 'node_modules', PACKAGE, 'dist')
    expect(invalidated).toEqual([join(dist, 'components/AFoo.js'), join(dist, 'common-admin.css')])
    expect(server.environments.client.hot.send).toHaveBeenCalledWith({ type: 'full-reload', path: '*' })
  })

  it.each([
    ['copy.sh', ''],
    ['the first copy of a watch', '*\n'],
  ])('not pre-bundled: after %s everything may have changed, so it restarts, not forced', (_, content) => {
    const root = tempRoot()
    const { server, trigger } = fakeServer(root, true)
    configureServer(commonAdminDevWatch({ prebundle: false }), server)
    trigger(content)
    expect(server.restart).toHaveBeenCalledWith()
  })

  it('not pre-bundled: a changed file importing a package not pre-bundled yet restarts the server', () => {
    const root = tempRoot()
    const dist = join(root, 'node_modules', PACKAGE, 'dist')
    mkdirSync(join(dist, 'components'), { recursive: true })
    writeFileSync(join(dist, 'components/ACopy.js'), "import { VBtn } from 'vuetify/components/VBtn'\n")
    const plugin = commonAdminDevWatch({ prebundle: false })
    ;(plugin.config as (config: unknown) => unknown)({ root, optimizeDeps: {} })
    const { server, trigger, invalidated } = fakeServer(root, true)
    configureServer(plugin, server)

    // An import it already had: invalidated in place.
    trigger('components/ACopy.js\n')
    expect(server.restart).not.toHaveBeenCalled()
    expect(invalidated).toEqual([join(dist, 'components/ACopy.js')])

    writeFileSync(
      join(dist, 'components/ACopy.js'),
      "import { VBtn } from 'vuetify/components/VBtn'\nimport { VRating } from 'vuetify/components/VRating'\n"
    )
    trigger('components/ACopy.js\n')
    expect(server.restart).toHaveBeenCalledWith()
  })

  // `yarn dev:admin` builds one bundle whose shared chunks are `.mjs`: an import appearing in one of
  // them has to restart the server like one in a `.js`, or it reaches the page raw.
  it('not pre-bundled: reads the bundle chunks too, and restarts on a new import in one', () => {
    const root = tempRoot()
    const dist = join(root, 'node_modules', PACKAGE, 'dist')
    mkdirSync(dist, { recursive: true })
    writeFileSync(join(dist, 'string-1iT9KZXT.mjs'), "import { ref } from 'vue'\n")
    const plugin = commonAdminDevWatch({ prebundle: false })
    const extra = (plugin.config as (config: unknown) => { optimizeDeps: { include: string[] } })({
      root,
      optimizeDeps: {},
    })
    expect(extra.optimizeDeps.include).toEqual([`${PACKAGE} > vue`])
    const { server, trigger } = fakeServer(root, true)
    configureServer(plugin, server)

    writeFileSync(
      join(dist, 'string-1iT9KZXT.mjs'),
      "import { ref } from 'vue'\nimport rt from 'dayjs/plugin/relativeTime'\n"
    )
    trigger('string-1iT9KZXT.mjs\n')
    expect(server.restart).toHaveBeenCalledWith()
  })

  it('not pre-bundled: leaves out what the admin excludes itself, and the testing entry', () => {
    const root = tempRoot()
    const dist = join(root, 'node_modules', PACKAGE, 'dist')
    mkdirSync(join(dist, 'testing'), { recursive: true })
    writeFileSync(
      join(dist, 'AMenu.js'),
      "import { VMenu } from 'vuetify/components/VMenu'\nimport dayjs from 'dayjs'\n"
    )
    writeFileSync(join(dist, 'testing.js'), "import { describe } from 'vitest'\n")
    writeFileSync(join(dist, 'testing/closeButtons.js'), "import { it } from 'vitest'\n")
    const plugin = commonAdminDevWatch({ prebundle: false })
    const extra = (plugin.config as (config: unknown) => { optimizeDeps: { include: string[] } })({
      root,
      optimizeDeps: { exclude: ['vuetify'] },
    })
    // Pre-bundled for the library as well, an excluded package would load twice.
    expect(extra.optimizeDeps.include).toEqual([`${PACKAGE} > dayjs`])

    // Still known, so a change that imports it is no new import.
    const { server, trigger } = fakeServer(root, true)
    configureServer(plugin, server)
    trigger('AMenu.js\n')
    expect(server.restart).not.toHaveBeenCalled()

    // The testing entry is rebuilt with the modules it imports; its vitest is no new import either.
    writeFileSync(
      join(dist, 'testing.js'),
      "import { describe } from 'vitest'\nimport { x } from './routeHistory-a1.mjs'\n"
    )
    trigger('testing.js\ntesting/closeButtons.js\nAMenu.js\n')
    expect(server.restart).not.toHaveBeenCalled()
  })

  // Vite serves a package it does not pre-bundle as immutable under an unchanged `?v=`: the browser
  // would keep the old file without asking.
  it('not pre-bundled: serves the library with no-cache', () => {
    const root = tempRoot()
    const { server } = fakeServer(root, true)
    configureServer(commonAdminDevWatch({ prebundle: false }), server)
    const middleware = server.middlewares.use.mock.calls[0]![0] as (
      req: unknown,
      res: unknown,
      next: () => void
    ) => void

    const served = (url: string) => {
      const setHeader = vi.fn()
      const res = { setHeader }
      const next = vi.fn()
      middleware({ url }, res, next)
      ;(res.setHeader as (name: string, value: string) => void)('Cache-Control', 'max-age=31536000,immutable')
      ;(res.setHeader as (name: string, value: string) => void)('Content-Type', 'text/javascript')
      expect(next).toHaveBeenCalled()
      return setHeader.mock.calls
    }
    expect(served(`/node_modules/${PACKAGE}/dist/common-admin.js?v=1`)).toEqual([
      ['Cache-Control', 'no-cache'],
      ['Content-Type', 'text/javascript'],
    ])
    expect(served('/node_modules/.vite/deps/vue.js?v=1')).toEqual([
      ['Cache-Control', 'max-age=31536000,immutable'],
      ['Content-Type', 'text/javascript'],
    ])
  })
})

describe('copy.sh', () => {
  // A `yarn dev:admin` leaves the files it changed listed in the trigger. `touch` kept that list, and
  // the admin then reloaded those few files over a node_modules copy.sh had just replaced whole --
  // measured: the page showed a mix of the two builds.
  const libraryWithBuild = () => {
    const library = tempRoot()
    for (const dir of ['dist', 'src/eslint', 'src/vite']) mkdirSync(join(library, dir), { recursive: true })
    for (const file of ['dist/common-admin.js', 'dist/common-admin.d.ts', 'dist/common-admin.css']) {
      writeFileSync(join(library, file), '')
    }
    writeFileSync(join(library, 'src/eslint/plugin.mjs'), '')
    writeFileSync(join(library, 'src/vite/index.mjs'), '')
    writeFileSync(join(library, 'package.json'), '{}')
    writeFileSync(join(library, '.env'), `COMMON_ADMIN_PROJECT=${library}\n`)
    execFileSync('cp', [resolve('copy.sh'), library])
    return library
  }

  it('empties the trigger file instead of touching it', () => {
    const library = libraryWithBuild()
    const admin = tempRoot()
    writeFileSync(join(admin, '.common-admin-updated'), 'components/AFoo.js\n')

    execFileSync('bash', [join(library, 'copy.sh'), admin], { stdio: 'pipe' })

    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('')
    expect(readFileSync(join(admin, 'node_modules', PACKAGE, 'package.json'), 'utf8')).toBe('{}')
  })

  it('never writes through a pnpm hard link into the store', () => {
    // pnpm: the package is a symlink into the virtual store, and every file there is a hard link to
    // the global content-addressable store -- written in place, it would change it for every project.
    const library = libraryWithBuild()
    const admin = tempRoot()
    const store = tempRoot()
    writeFileSync(join(store, 'package.json'), '{"version":"2.0.0"}')
    writeFileSync(join(store, 'common-admin.js'), 'published')
    const virtual = join(admin, 'node_modules/.pnpm/@anzusystems+common-admin@2.0.0/node_modules', PACKAGE)
    mkdirSync(join(virtual, 'dist'), { recursive: true })
    linkSync(join(store, 'package.json'), join(virtual, 'package.json'))
    linkSync(join(store, 'common-admin.js'), join(virtual, 'dist/common-admin.js'))
    mkdirSync(join(admin, 'node_modules/@anzusystems'), { recursive: true })
    symlinkSync(virtual, join(admin, 'node_modules', PACKAGE))

    execFileSync('bash', [join(library, 'copy.sh'), admin], { stdio: 'pipe' })

    expect(readFileSync(join(admin, 'node_modules', PACKAGE, 'package.json'), 'utf8')).toBe('{}')
    expect(readFileSync(join(store, 'package.json'), 'utf8')).toBe('{"version":"2.0.0"}')
    expect(readFileSync(join(store, 'common-admin.js'), 'utf8')).toBe('published')
  })
})
