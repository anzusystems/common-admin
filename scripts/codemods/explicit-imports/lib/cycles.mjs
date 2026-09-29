import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Value import edges between the admin's own modules (type-only imports and dynamic `import()` do
 * not take part in module initialisation) and the cycles they form.
 */
function resolveLocal(srcDir, fromFile, specifier) {
  let base
  if (specifier.startsWith('@/')) base = join(srcDir, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export function valueImports(ts, code, js = false) {
  const sourceFile = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ESNext, true, js ? ts.ScriptKind.JS : ts.ScriptKind.TS)
  const specifiers = []
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly) continue
      const bindings = clause?.namedBindings
      const onlyInlineTypes =
        clause && !clause.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 &&
        bindings.elements.every((e) => e.isTypeOnly)
      if (onlyInlineTypes) continue
      specifiers.push(statement.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
      specifiers.push(statement.moduleSpecifier.text)
    }
  }
  return specifiers
}

/** @param modules {Map<string, string[]>} file -> import specifiers */
export function buildGraph(srcDir, adminDir, modules) {
  const edges = new Set()
  for (const [file, specifiers] of modules) {
    for (const specifier of specifiers) {
      const target = resolveLocal(srcDir, file, specifier)
      if (target && modules.has(target)) edges.add(`${relative(adminDir, file)} -> ${relative(adminDir, target)}`)
    }
  }
  return edges
}

/** Strongly connected components with more than one module, or a module importing itself. */
export function findCycles(edges) {
  const graph = new Map()
  for (const edge of edges) {
    const [from, to] = edge.split(' -> ')
    if (!graph.has(from)) graph.set(from, [])
    if (!graph.has(to)) graph.set(to, [])
    graph.get(from).push(to)
  }
  let index = 0
  const indices = new Map()
  const lowlinks = new Map()
  const stack = []
  const onStack = new Set()
  const components = []
  const strongConnect = (start) => {
    const work = [[start, 0]]
    indices.set(start, index)
    lowlinks.set(start, index++)
    stack.push(start)
    onStack.add(start)
    while (work.length) {
      const frame = work.at(-1)
      const [node, i] = frame
      const next = graph.get(node)[i]
      if (next !== undefined) {
        frame[1]++
        if (!indices.has(next)) {
          indices.set(next, index)
          lowlinks.set(next, index++)
          stack.push(next)
          onStack.add(next)
          work.push([next, 0])
        } else if (onStack.has(next)) {
          lowlinks.set(node, Math.min(lowlinks.get(node), indices.get(next)))
        }
        continue
      }
      work.pop()
      if (work.length) {
        const parent = work.at(-1)[0]
        lowlinks.set(parent, Math.min(lowlinks.get(parent), lowlinks.get(node)))
      }
      if (lowlinks.get(node) === indices.get(node)) {
        const component = []
        let member
        do {
          member = stack.pop()
          onStack.delete(member)
          component.push(member)
        } while (member !== node)
        if (component.length > 1 || graph.get(node).includes(node)) components.push(component.sort())
      }
    }
  }
  for (const node of [...graph.keys()].sort()) if (!indices.has(node)) strongConnect(node)
  return components.sort((a, b) => a[0].localeCompare(b[0]))
}

/** Edges that are new and lie inside a cycle after the change. */
export function newCycleEdges(before, after) {
  const cycles = findCycles(after)
  const member = new Map()
  cycles.forEach((component, i) => component.forEach((file) => member.set(file, i)))
  return [...after]
    .filter((edge) => !before.has(edge))
    .filter((edge) => {
      const [from, to] = edge.split(' -> ')
      return member.has(from) && member.get(from) === member.get(to)
    })
    .sort()
}
