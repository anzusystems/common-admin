#!/usr/bin/env node
/**
 * Sorts the imports of an admin with its own oxlint and oxfmt configuration.
 *
 *   node scripts/codemods/explicit-imports/sort.mjs /path/to/admin
 *
 * `oxlint --fix` runs until it changes nothing, at most five times (a merge by
 * `import/no-duplicates` can leave members for `sort-imports` to order), then oxfmt; after that
 * both have to pass in check mode without touching a file.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const adminDir = resolve(process.argv[2] ?? '.')
const MAX_FIX_PASSES = 5

function run(script, { allowFailure = false } = {}) {
  const result = spawnSync('yarn', ['run', script], { cwd: adminDir, encoding: 'utf8' })
  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stdout + result.stderr)
    throw new Error(`yarn ${script} failed`)
  }
  return result
}

function fingerprint(dir = adminDir) {
  const hash = createHash('sha256')
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(ts|mts|mjs|vue)$/.test(entry.name)) hash.update(path).update(readFileSync(path))
    }
  }
  walk(dir)
  return hash.digest('hex')
}

let passes = 0
for (let before = fingerprint(); ; ) {
  if (passes === MAX_FIX_PASSES) throw new Error(`oxlint --fix still changes files after ${MAX_FIX_PASSES} passes`)
  run('lint:oxlint:fix', { allowFailure: true })
  passes++
  const after = fingerprint()
  if (after === before) break
  before = after
}
run('format')
const formatted = fingerprint()
run('lint:oxlint')
run('format:check')
if (fingerprint() !== formatted) throw new Error('the check run changed files')
console.log(`sorted in ${passes} oxlint --fix passes (the last one changed nothing), oxfmt, both clean in check mode`)
