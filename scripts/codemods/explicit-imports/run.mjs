#!/usr/bin/env node
/**
 * Replaces unplugin-auto-import in an admin with explicit imports, and checks the result.
 *
 *   node scripts/codemods/explicit-imports/run.mjs /path/to/admin [--keep-dts] [--deps-from /path/to/admin]
 *
 * Before touching a file it records what unimport injects today, the template bindings and the
 * runtime props of every component and the import graph; after the edit it requires that unimport
 * would inject nothing, that no template reference changed its target except `_ctx.X` becoming
 * `$setup.X` for a name it now imports, that no prop gained a `Boolean` or `Function` type and that
 * no new import cycle appeared. Exceptions come from `scripts/explicit-imports.allowlist.json` in
 * the admin. The manifest goes to `scripts/explicit-imports.manifest.json`; the exit code is 1 when
 * anything is left unexplained. Run it before unplugin-auto-import is removed: it uses the admin's
 * unimport, Vue compiler and TypeScript.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph, findCycles, newCycleEdges, valueImports } from './lib/cycles.mjs'
import { loadAdminDeps } from './lib/deps.mjs'
import { createDetector } from './lib/detect.mjs'
import { addImports } from './lib/insert.mjs'
import { readAutoImports } from './lib/names.mjs'
import { findUnboundReferences } from './lib/references.mjs'
import { compileSfc, isTsBlock, parseSfc, runtimeProps, templateTargets } from './lib/sfc.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const adminDir = resolve(args[0] ?? '.')
const keepDts = args.includes('--keep-dts')
const depsFrom = args.includes('--deps-from') ? resolve(args[args.indexOf('--deps-from') + 1]) : adminDir
const srcDir = join(adminDir, 'src')
const rel = (file) => relative(adminDir, file)
const sortedObject = (entries) => Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)))

const deps = await loadAdminDeps(depsFrom)
const { ts, sfc } = deps

// 1. The names, from a freshly generated declaration file: `dtsMode: 'append'` keeps stale ones.
const dtsFile = join(srcDir, 'auto-imports.d.ts')
if (!keepDts) {
  rmSync(dtsFile, { force: true })
  const generated = spawnSync(process.execPath, ['scripts/generate-dts.mjs'], { cwd: adminDir, encoding: 'utf8' })
  if (generated.status !== 0) throw new Error(`generate-dts failed:\n${generated.stderr}`)
}
const names = readAutoImports(readFileSync(dtsFile, 'utf8'))

const allowlistFile = join(adminDir, 'scripts/explicit-imports.allowlist.json')
const allowlist = existsSync(allowlistFile) ? JSON.parse(readFileSync(allowlistFile, 'utf8')) : {}
const allowed = (section, key, name) => {
  const entry = allowlist[section]?.[key]
  return name === undefined ? entry !== undefined : entry?.[name] !== undefined
}
const usedAllowlist = new Set()
const violations = []
const violation = (section, key, name, message) => {
  if (allowed(section, key, name)) {
    usedAllowlist.add(`${section}:${key}${name === undefined ? '' : `:${name}`}`)
    return
  }
  violations.push(`${key}: ${message}`)
}

function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(path))
    else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}
const files = listFiles(srcDir).sort()

// 2. Before: what unimport injects, template targets, runtime props, the import graph.
const detector = createDetector(deps, names)
async function snapshot(file, source) {
  const result = { detect: await detector.detect(file, source) }
  if (file.endsWith('.vue')) {
    const descriptor = parseSfc(sfc, file, source)
    const dev = compileSfc(sfc, ts, file, descriptor)
    result.bindings = dev.bindings
    result.render = dev.render
    result.targets = templateTargets(dev.render)
    result.props = { dev: runtimeProps(dev.script), prod: runtimeProps(compileSfc(sfc, ts, file, descriptor, { isProd: true }).script) }
    result.imports = [descriptor.script, descriptor.scriptSetup]
      .filter(Boolean)
      .flatMap((block) => valueImports(ts, block.content, !isTsBlock(block)))
  } else {
    result.imports = valueImports(ts, source)
  }
  return result
}

const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
const before = new Map()
for (const file of files) {
  try {
    before.set(file, await snapshot(file, sources.get(file)))
  } catch (error) {
    violations.push(`${rel(file)}: cannot be compiled before the change: ${error.message.split('\n')[0]}`)
  }
}
if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}

// 3. What each file uses without binding it.
const units = []
const renderUnits = []
const sfcs = new Map()
for (const file of files) {
  const source = sources.get(file)
  if (!file.endsWith('.vue')) {
    units.push({ id: file, code: source, file, block: null })
    continue
  }
  const descriptor = parseSfc(sfc, file, source)
  sfcs.set(file, descriptor)
  const snap = before.get(file)
  if (snap.render && isTsBlock(descriptor.scriptSetup ?? descriptor.script)) {
    renderUnits.push({ id: `${file}.render.ts`, code: snap.render })
  }
  for (const [blockName, block] of [['script', descriptor.script], ['scriptSetup', descriptor.scriptSetup]]) {
    if (!block) continue
    const generic = blockName === 'scriptSetup' && block.attrs.generic
    const code = generic ? `${block.content}\ntype __ExplicitImportsGeneric<${block.attrs.generic}> = 0\n` : block.content
    units.push({ id: `${file}.${blockName}.${isTsBlock(block) ? 'ts' : 'js'}`, code, js: !isTsBlock(block), file, block: blockName })
  }
}
const renderResults = findUnboundReferences(ts, renderUnits, names)
for (const unit of units) {
  if (unit.block !== 'scriptSetup') continue
  const render = renderResults.get(`${unit.file}.render.ts`)
  if (render) unit.templateTypes = render.type
}
const results = findUnboundReferences(ts, units, names)

// 4. Edits.
const source = (name, typeOnly) => {
  const entry = typeOnly ? (names.types.get(name) ?? names.values.get(name)) : names.values.get(name)
  return { from: entry.from, name: { imported: entry.imported, local: name } }
}
function additionsFor(value, type) {
  const groups = new Map()
  for (const [set, typeOnly] of [[value, false], [type, true]]) {
    for (const name of set) {
      const { from, name: spec } = source(name, typeOnly)
      const key = `${typeOnly ? 'type' : 'value'} ${from}`
      if (!groups.has(key)) groups.set(key, { from, typeOnly, names: [] })
      groups.get(key).names.push(spec)
    }
  }
  return [...groups.values()].sort((a, b) => a.from.localeCompare(b.from) || Number(a.typeOnly) - Number(b.typeOnly))
}

const manifestFiles = {}
const edited = new Map()
for (const file of files) {
  const key = rel(file)
  const snap = before.get(file)
  const entry = {}
  if (!file.endsWith('.vue')) {
    const result = results.get(file)
    result.problems.forEach((p) => violation('problems', key, undefined, p))
    const additions = additionsFor(result.value, result.type)
    if (additions.length) {
      edited.set(file, addImports(ts, sources.get(file), additions))
      if (result.value.size) entry.script = [...result.value].sort()
      if (result.type.size) entry.types = [...result.type].sort()
    }
  } else {
    const descriptor = sfcs.get(file)
    let text = sources.get(file)
    const blocks = []
    const templateNames = [...snap.detect.template].sort()
    for (const blockName of ['script', 'scriptSetup']) {
      const block = descriptor[blockName]
      if (!block) continue
      const result = results.get(`${file}.${blockName}.${isTsBlock(block) ? 'ts' : 'js'}`)
      result.problems.forEach((p) => violation('problems', key, undefined, p))
      const value = new Set(result.value)
      if (blockName === 'scriptSetup') templateNames.forEach((name) => value.add(name))
      for (const name of value) {
        if (snap.bindings[name] === 'props') {
          violation('problems', key, name, `${name} is a prop and would be shadowed by the import`)
        }
      }
      const additions = additionsFor(value, result.type)
      if (!additions.length) continue
      blocks.push({ block, content: addImports(ts, block.content, additions, { js: !isTsBlock(block) }) })
      if (result.value.size) entry[blockName === 'script' ? 'script' : 'setup'] = [...result.value].sort()
      if (result.type.size) entry[blockName === 'script' ? 'scriptTypes' : 'types'] = [...result.type].sort()
    }
    if (templateNames.length) {
      entry.template = templateNames
      if (!descriptor.scriptSetup) violation('problems', key, undefined, 'template uses auto-imports but there is no <script setup>')
    }
    blocks.sort((a, b) => b.block.loc.start.offset - a.block.loc.start.offset)
    for (const { block, content } of blocks) {
      text = text.slice(0, block.loc.start.offset) + content + text.slice(block.loc.end.offset)
    }
    if (blocks.length) edited.set(file, text)
  }
  if (Object.keys(entry).length) manifestFiles[key] = entry
}

for (const [file, text] of edited) writeFileSync(file, text)

// 5. After.
for (const file of edited.keys()) sfc.invalidateTypeCache?.(file)
const after = new Map()
for (const file of files) {
  const text = edited.get(file) ?? sources.get(file)
  try {
    after.set(file, await snapshot(file, text))
  } catch (error) {
    violation('problems', rel(file), undefined, `cannot be compiled after the change: ${error.message.split('\n')[0]}`)
  }
}

const propsChanges = {}
const count = (text, word) => text.match(new RegExp(`\\b${word}\\b`, 'g'))?.length ?? 0
for (const file of files) {
  const key = rel(file)
  const was = before.get(file)
  const now = after.get(file)
  if (!now) continue
  const entry = manifestFiles[key]
  // unimport would inject nothing any more
  for (const name of [...now.detect.script, ...now.detect.template]) {
    violation('residualInjections', key, name, `unimport would still inject ${name}`)
  }
  // what the codemod added against what unimport injected before
  const addedScript = new Set([...(entry?.script ?? []), ...(entry?.setup ?? [])])
  for (const name of addedScript) {
    if (!was.detect.script.has(name) && !was.detect.template.has(name)) {
      violation('differences', key, name, `${name} is imported now, but unimport did not inject it before`)
    }
  }
  if (!file.endsWith('.vue')) continue
  // template targets: only _ctx -> $setup for a name imported now and injected before
  const imported = new Set([...addedScript, ...(entry?.template ?? [])])
  for (const name of new Set([...Object.keys(was.targets), ...Object.keys(now.targets)])) {
    const from = (was.targets[name] ?? []).join(',')
    const to = (now.targets[name] ?? []).join(',')
    if (from === to) continue
    const expected = from === '_ctx' && to === '$setup' && imported.has(name) && was.detect.template.has(name)
    if (!expected) violation('templateTargets', key, name, `template reference ${name}: ${from || '-'} -> ${to || '-'}`)
  }
  for (const mode of ['dev', 'prod']) {
    if (was.props[mode] === now.props[mode]) continue
    ;(propsChanges[key] ??= {})[mode] = { before: was.props[mode], after: now.props[mode] }
    for (const word of ['Boolean', 'Function']) {
      if (count(now.props[mode], word) > count(was.props[mode], word)) {
        violation('propsTypes', key, word, `a prop gained the runtime type ${word} (${mode})`)
      }
    }
  }
}

const graph = (snaps) =>
  buildGraph(srcDir, adminDir, new Map(files.filter((f) => snaps.get(f)).map((f) => [f, snaps.get(f).imports])))
const edgesBefore = graph(before)
const edgesAfter = graph(after)
const cycleEdges = newCycleEdges(edgesBefore, edgesAfter)
for (const edge of cycleEdges) violation('cycles', edge, undefined, 'new import edge inside a cycle')

for (const entry of Object.keys(allowlist).flatMap((section) =>
  Object.entries(allowlist[section]).flatMap(([key, value]) =>
    typeof value === 'object' ? Object.keys(value).map((name) => `${section}:${key}:${name}`) : [`${section}:${key}`],
  ),
)) {
  if (!usedAllowlist.has(entry)) violations.push(`allowlist entry not needed: ${entry}`)
}

// 6. Manifest.
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()
const libraryDir = resolve(scriptDir, '../../..')
const scriptPath = relative(libraryDir, scriptDir)
const scriptDirty = git(libraryDir, 'status', '--porcelain', '--', scriptPath) !== ''
const archive = execFileSync('sh', ['-c', `git -C "${libraryDir}" archive HEAD "${scriptPath}" 2>/dev/null | sha256sum`], {
  encoding: 'utf8',
})
const statements = Object.values(manifestFiles).reduce((sum, entry) => {
  const modules = (list, typeOnly) => new Set((list ?? []).map((n) => source(n, typeOnly).from))
  return (
    sum +
    modules([...(entry.script ?? []), ...(entry.setup ?? []), ...(entry.template ?? [])], false).size +
    modules([...(entry.types ?? []), ...(entry.scriptTypes ?? [])], true).size
  )
}, 0)
const manifest = {
  admin: basename(adminDir),
  inputCommit: git(adminDir, 'rev-parse', 'HEAD'),
  script: {
    commonAdminCommit: git(libraryDir, 'rev-parse', 'HEAD'),
    path: scriptPath,
    archiveSha256: archive.split(' ')[0],
    dirty: scriptDirty,
  },
  tools: deps.versions,
  names: { values: names.values.size, types: names.types.size },
  totals: { files: Object.keys(manifestFiles).length, importDeclarations: statements, propsChanged: Object.keys(propsChanges).length },
  files: sortedObject(Object.entries(manifestFiles)),
  props: sortedObject(Object.entries(propsChanges)),
  cycles: { before: findCycles(edgesBefore), after: findCycles(edgesAfter), newEdges: cycleEdges },
  allowlistUsed: [...usedAllowlist].sort(),
  violations: violations.sort(),
}
writeFileSync(join(adminDir, 'scripts/explicit-imports.manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(
  `${manifest.admin}: ${manifest.totals.files} files, ${manifest.totals.importDeclarations} import declarations, ` +
    `${manifest.totals.propsChanged} components with changed runtime props, ${violations.length} violations`,
)
if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
