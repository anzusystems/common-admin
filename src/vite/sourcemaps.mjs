import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const LIBRARY_DIST_FILE = /[\\/]node_modules[\\/]@anzusystems[\\/]common-admin[\\/]dist[\\/].+\.m?js$/
const SOURCE_MAPPING_URL = /\/\/# sourceMappingURL=([^\s'"]+)\s*$/

/**
 * Feeds common-admin's published source maps into the admin's build.
 * Vite ignores `sourceMappingURL` in node_modules files, so Sentry would show the library minified.
 * Loading the file with its map lets the bundler chain them to the `.vue` and `.ts` sources.
 * Does nothing unless the build emits source maps.
 */
export function commonAdminSourcemaps() {
  let enabled = false

  return {
    name: 'anzu:common-admin-sourcemaps',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      enabled = !!config.build.sourcemap
    },
    load: {
      filter: { id: LIBRARY_DIST_FILE },
      handler(id) {
        if (!enabled) return null
        const code = readFileSync(id, 'utf8')
        const mapFile = resolve(dirname(id), code.match(SOURCE_MAPPING_URL)?.[1] ?? `${id}.map`)
        if (!existsSync(mapFile)) return null
        return { code, map: readFileSync(mapFile, 'utf8') }
      },
    },
  }
}
