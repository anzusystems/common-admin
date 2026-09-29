import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

function packageVersion(entry, name) {
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    const file = join(dir, 'package.json')
    if (!existsSync(file)) continue
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    if (pkg.name === name) return pkg.version
  }
  throw new Error(`package.json of ${name} not found above ${entry}`)
}

/**
 * The tools come from the admin, not from common-admin: the verifier has to see the code with the
 * same unimport and Vue compiler the admin builds with, and common-admin does not have unimport.
 */
export async function loadAdminDeps(adminDir) {
  const require = createRequire(join(adminDir, 'package.json'))
  const resolve = (name) => require.resolve(name)
  const ts = require('typescript')
  const sfc = await import(pathToFileURL(resolve('@vue/compiler-sfc')).href)
  const unimport = await import(pathToFileURL(resolve('unimport')).href)
  sfc.registerTS(() => ts)
  const versions = {}
  for (const name of ['typescript', '@vue/compiler-sfc', 'unimport', 'unplugin-auto-import']) {
    versions[name] = packageVersion(resolve(name), name)
  }
  return { ts, sfc, unimport, versions }
}
