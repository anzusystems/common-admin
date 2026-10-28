import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const PACKAGE = '@anzusystems/common-admin'
const PACKAGE_URL = `/node_modules/${PACKAGE}/`
const BARE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"./][^'"]*)['"]/g
// A package name with an optional subpath: filters out what the pattern above also finds inside strings.
const PACKAGE_ID = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:\/[\w.-]+)*$/

// `./testing` is loaded only by tests. Its imports (vitest) need no dev server bundling.
// The path is relative to `dist`.
const isTesting = (file) => /^testing($|\.m?js$|[\\/])/.test(file)

const bareImports = (code) => {
  const found = new Set()
  for (const [, id] of code.matchAll(BARE_IMPORT)) {
    if (PACKAGE_ID.test(id) && !id.startsWith(PACKAGE) && !id.endsWith('.css')) found.add(id)
  }
  return found
}

/**
 * Every package the library's files import, read from the copy in the admin's
 * node_modules. Pre-bundled for them (`pkg > id`) when the library is not.
 * A package file importing a non-pre-bundled dependency gets it raw, as a second copy next to
 * the admin's (two Vuetify instances, two overlay stacks). A CommonJS one does not load at all.
 * Derived, not listed. A new import during a session restarts the server, which derives the list again.
 */
const nestedDependencies = (root) => {
  const dist = join(root, 'node_modules', PACKAGE, 'dist')
  const found = new Set()
  if (!existsSync(dist)) return found
  // Includes `.mjs`: the dev bundle names its shared chunks so.
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (isTesting(relative(dist, full))) continue
      if (entry.isDirectory()) walk(full)
      else if (/\.m?js$/.test(entry.name)) for (const id of bareImports(readFileSync(full, 'utf8'))) found.add(id)
    }
  }
  walk(dist)
  return found
}

// TODO: remove once Vite ships https://github.com/vitejs/vite/pull/23499 (issue vitejs/vite#23493, not fixed in 8.3.1).
// A restart passes `previousEnvironments: server.environments`, and the new server keeps it
// in its closure. Each restart leaked the old environments and module graphs, +45-100 MB.
// The restart gets a copy, emptied once the new server is up. If the
// restart fails, the server still runs on the copy and it stays.
const restartReleasingPrevious = async (server, forceOptimize) => {
  const handover = { ...server.environments }
  server.environments = handover
  await (forceOptimize ? server.restart(true) : server.restart())
  if (server.environments === handover) return
  for (const name of Object.keys(handover)) delete handover[name]
}

/**
 * Picks up a common-admin that `./copy.sh` or `yarn dev:admin` wrote into the admin's node_modules. Both write
 * `.common-admin-updated` in the admin's root (copy.sh empties it, `yarn dev:admin` lists changed files).
 * - Pre-bundled (default): restarts the server with forced re-optimization. A full reload
 * is not enough because the browser keeps the old bundle under an unchanged `?v=`.
 * - `prebundle: false`: only files listed in the trigger file are invalidated, then the page reloads.
 * They get `Cache-Control: no-cache` instead of `immutable`, so the browser revalidates them.
 * A changed file importing a new package restarts the server instead,
 * as do copy.sh and the watch's first copy. Does nothing in a build.
 */
export function commonAdminDevWatch({ triggerFile = '.common-admin-updated', prebundle = true } = {}) {
  // What the optimizer pre-bundles for the library, as this server started with it.
  let known = new Set()
  return {
    name: 'anzu:common-admin-dev-watch',
    apply: 'serve',
    config(config) {
      if (prebundle) return
      if (config.optimizeDeps?.include) {
        config.optimizeDeps.include = config.optimizeDeps.include.filter((id) => id !== PACKAGE)
      }
      known = nestedDependencies(resolve(config.root ?? process.cwd()))
      // Packages the admin excludes reach it raw. Pre-bundled for the library too, they would load twice.
      // `known` keeps them, so a change importing one is not treated as a new import.
      const own = config.optimizeDeps?.exclude ?? []
      const include = [...known].filter((id) => !own.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)))
      return {
        optimizeDeps: { exclude: [PACKAGE], include: include.sort().map((id) => `${PACKAGE} > ${id}`) },
      }
    },
    configureServer(server) {
      const { root, logger, optimizeDeps } = server.config
      const trigger = resolve(root, triggerFile)
      const excluded = !!optimizeDeps.exclude?.includes(PACKAGE)
      const log = (message) => logger.info(`[common-admin] ${message}`, { timestamp: true })

      if (excluded) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.includes(PACKAGE_URL)) {
            const setHeader = res.setHeader.bind(res)
            res.setHeader = (name, value) =>
              setHeader(name, name.toLowerCase() === 'cache-control' ? 'no-cache' : value)
          }
          next()
        })
      }

      const onTrigger = (file) => {
        if (file !== trigger) return
        const listed = readFileSync(trigger, 'utf8').split('\n').filter(Boolean)
        // Pre-bundled: the optimizer's bundle hash ignores the library's
        // content, so only a forced re-optimization picks up the new build.
        if (!excluded) {
          log('replaced, restarting the server...')
          void restartReleasingPrevious(server, true)
          return
        }
        // copy.sh (empty file, deletes optimized deps) or the watch's first copy (`*`): anything may have changed.
        // Not forced: the library is not pre-bundled, and a changed import list changes the
        // optimizer hash itself. Forcing would discard runtime discoveries and cost extra reloads.
        if (listed.length === 0 || listed.includes('*')) {
          log('replaced, restarting the server...')
          void restartReleasingPrevious(server)
          return
        }
        const packageDir = join(root, 'node_modules', PACKAGE)
        const distDir = join(existsSync(packageDir) ? realpathSync(packageDir) : packageDir, 'dist')
        // A package no library file imported at server start is not pre-bundled, and Vite
        // does not discover imports from node_modules. The restart derives the list again.
        const added = listed
          .filter((changed) => /\.m?js$/.test(changed) && !isTesting(changed) && existsSync(join(distDir, changed)))
          .flatMap((changed) => [...bareImports(readFileSync(join(distDir, changed), 'utf8'))])
          .filter((id) => !known.has(id))
        if (added.length > 0) {
          log(`new import of ${[...new Set(added)].join(', ')}, restarting the server...`)
          void restartReleasingPrevious(server)
          return
        }
        const environment = server.environments.client
        let invalidated = 0
        for (const changed of listed) {
          // The module graph keys files by forward-slash paths, also on Windows.
          const file = join(distDir, changed).replaceAll('\\', '/')
          for (const mod of environment.moduleGraph.getModulesByFile(file) ?? []) {
            environment.moduleGraph.invalidateModule(mod)
            invalidated++
          }
        }
        log(`${listed.length} file(s) changed, ${invalidated} module(s) invalidated, reloading the page`)
        environment.hot.send({ type: 'full-reload', path: '*' })
      }
      server.watcher.add(trigger)
      // `add` too: on a fresh checkout the file does not exist until the first copy creates it
      server.watcher.on('add', onTrigger)
      server.watcher.on('change', onTrigger)
    },
  }
}
