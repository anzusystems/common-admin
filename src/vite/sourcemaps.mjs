import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const LIBRARY_DIST_FILE = /[\\/]node_modules[\\/]@anzusystems[\\/]common-admin[\\/]dist[\\/].+\.m?js$/
const SOURCE_MAPPING_URL = /\/\/# sourceMappingURL=([^\s'"]+)\s*$/

/**
 * Feeds the source maps common-admin publishes into the admin's build.
 *
 * Vite ignores `sourceMappingURL` in files it loads from node_modules, so without this the admin's
 * maps end at `dist/common-admin.js` and Sentry shows the library minified. Loading the file
 * together with its map lets the bundler chain them: frames resolve to the library's `.vue` and
 * `.ts` sources. Does nothing unless the build emits source maps.
 *
 * @returns {import('vite').Plugin}
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
