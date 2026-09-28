import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const PACKAGE = '@anzusystems/common-admin'
const PACKAGE_URL = `/node_modules/${PACKAGE}/`
const BARE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"./][^'"]*)['"]/g
// A package name with an optional subpath: filters out what the pattern above also finds inside strings.
const PACKAGE_ID = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:\/[\w.-]+)*$/

// `./testing`, which only tests load: its imports (vitest) are nothing the dev server has to bundle.
// A path relative to `dist`.
const isTesting = (file) => /^testing($|\.m?js$|[\\/])/.test(file)

// The other packages one built file imports.
const bareImports = (code) => {
  const found = new Set()
  for (const [, id] of code.matchAll(BARE_IMPORT)) {
    if (PACKAGE_ID.test(id) && !id.startsWith(PACKAGE) && !id.endsWith('.css')) found.add(id)
  }
  return found
}

/**
 * Everything the library's files import from other packages -- `vuetify/components/VMenu`, `dayjs`,
 * `axios`... -- read off the copy in the admin's node_modules. Pre-bundled for them (`pkg > id`) when
 * the library itself is not: a package file importing a dependency that is not pre-bundled gets it
 * raw, as a second copy next to the admin's own pre-bundled one (two Vuetify module instances, each
 * with its own overlay stack), and a CommonJS one not at all. Derived, not listed; an import that
 * appears during a session restarts the server, which derives the list again.
 */
const nestedDependencies = (root) => {
  const dist = join(root, 'node_modules', PACKAGE, 'dist')
  const found = new Set()
  if (!existsSync(dist)) return found
  // `.mjs` too: the dev bundle names its shared chunks so.
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

/**
 * Picks up a common-admin that `./copy.sh` or `yarn dev:admin` wrote into the admin's node_modules.
 * Both write `.common-admin-updated` in the admin's root (copy.sh empties it, `yarn dev:admin` lists
 * the files it changed); this plugin watches it.
 *
 * - common-admin pre-bundled (in `optimizeDeps.include`, the default): restarts the server with a
 *   forced re-optimization. A plain full reload is not enough: the browser keeps the old bundle under
 *   an unchanged `?v=`.
 * - `prebundle: false` (common-admin in `optimizeDeps.exclude`): its files are served one by one, so only the ones the
 *   trigger file lists (`yarn dev:admin` writes them there) are invalidated, then the page reloads.
 *   Their responses get `Cache-Control: no-cache` instead of `immutable`, so the browser revalidates
 *   them (a 304 for the unchanged ones) instead of keeping the old ones under the same `?v=`. A changed
 *   file that imports a package the library did not import before restarts the server instead, and so
 *   do copy.sh and the watch's first copy.
 *
 * Does nothing in a build.
 *
 * @param {import('./index.d.mts').CommonAdminDevWatchOptions} [options]
 * @returns {import('vite').Plugin}
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
      // What the admin excludes reaches it raw; pre-bundled for the library as well, it would load twice.
      // `known` keeps them, so a change importing one is not taken for a new import.
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
        // Pre-bundled: the library is inside the optimizer's bundle, whose hash does not see its content,
        // so only a forced re-optimization picks the new build up.
        if (!excluded) {
          log('replaced, restarting the server...')
          void server.restart(true)
          return
        }
        // copy.sh (an empty file, and it deletes the optimized deps) or the watch's first copy (`*`):
        // everything may have changed. Not forced: the library is not in the pre-bundle, and a changed
        // list of its imports changes the optimizer's hash by itself; forcing would only throw away what
        // it discovered at runtime and cost a round of reloads.
        if (listed.length === 0 || listed.includes('*')) {
          log('replaced, restarting the server...')
          void server.restart()
          return
        }
        const packageDir = join(root, 'node_modules', PACKAGE)
        const distDir = join(existsSync(packageDir) ? realpathSync(packageDir) : packageDir, 'dist')
        // A package none of the library's files imported when this server started: it is not pre-bundled,
        // and Vite does not discover imports made from node_modules. The restart derives the list again.
        const added = listed
          .filter((changed) => /\.m?js$/.test(changed) && !isTesting(changed) && existsSync(join(distDir, changed)))
          .flatMap((changed) => [...bareImports(readFileSync(join(distDir, changed), 'utf8'))])
          .filter((id) => !known.has(id))
        if (added.length > 0) {
          log(`new import of ${[...new Set(added)].join(', ')}, restarting the server...`)
          void server.restart()
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
