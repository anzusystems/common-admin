#!/usr/bin/env node
/**
 * Runs the codemod over the fixtures and compares the result with `expected/`.
 *
 *   node scripts/codemods/explicit-imports/test/run-tests.mjs --deps-from /path/to/admin [--update]
 *
 * The tools (TypeScript, the Vue compiler, unimport) come from the admin given, as in a real run.
 * `ok` has to pass with no violation; `problems` has to fail with exactly the violations expected.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const depsFrom = args[args.indexOf('--deps-from') + 1]
const update = args.includes('--update')
if (!args.includes('--deps-from') || !depsFrom) throw new Error('--deps-from /path/to/admin is required')

const list = (dir) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|vue)$/.test(f) && !f.endsWith('auto-imports.d.ts'))
    .sort()

let failures = 0
for (const name of ['ok', 'problems']) {
  const work = mkdtempSync(join(tmpdir(), `explicit-imports-${name}-`))
  try {
    cpSync(join(testDir, 'fixtures', name), work, { recursive: true })
    mkdirSync(join(work, 'scripts'), { recursive: true })
    const git = (...a) => execFileSync('git', ['-C', work, ...a], { stdio: 'ignore' })
    git('init', '-q')
    git('add', '-A')
    git('-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-qm', 'fixture')
    const result = spawnSync(
      process.execPath,
      [join(testDir, '../run.mjs'), work, '--keep-dts', '--deps-from', depsFrom],
      { encoding: 'utf8' },
    )
    const manifest = JSON.parse(readFileSync(join(work, 'scripts/explicit-imports.manifest.json'), 'utf8'))
    const summary = {
      exitCode: result.status,
      totals: manifest.totals,
      files: manifest.files,
      props: manifest.props,
      newCycleEdges: manifest.cycles.newEdges,
      violations: manifest.violations,
    }
    const expectedDir = join(testDir, 'expected', name)
    if (update) {
      rmSync(expectedDir, { recursive: true, force: true })
      for (const file of list(join(work, 'src'))) {
        mkdirSync(dirname(join(expectedDir, 'src', file)), { recursive: true })
        cpSync(join(work, 'src', file), join(expectedDir, 'src', file))
      }
      writeFileSync(join(expectedDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
      console.log(`${name}: expected output updated`)
      continue
    }
    const problems = []
    const expectedSummary = readFileSync(join(expectedDir, 'summary.json'), 'utf8')
    if (JSON.stringify(summary, null, 2) + '\n' !== expectedSummary) problems.push('summary.json differs')
    const actualFiles = list(join(work, 'src'))
    const expectedFiles = existsSync(join(expectedDir, 'src')) ? list(join(expectedDir, 'src')) : []
    if (actualFiles.join('\n') !== expectedFiles.join('\n')) problems.push('file list differs')
    for (const file of actualFiles) {
      const expectedFile = join(expectedDir, 'src', file)
      if (!existsSync(expectedFile) || readFileSync(expectedFile, 'utf8') !== readFileSync(join(work, 'src', file), 'utf8')) {
        problems.push(`${relative(testDir, expectedFile)} differs`)
      }
    }
    if (problems.length) {
      failures++
      console.log(`FAIL ${name}:\n  ${problems.join('\n  ')}\n${result.stdout}${result.stderr}`)
      if (problems.includes('summary.json differs')) console.log(JSON.stringify(summary, null, 2))
    } else {
      console.log(`ok ${name}`)
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
process.exit(failures ? 1 : 0)
