import { describe, expect, it } from 'vitest'

// Runtime import cycles in the library. In a cycle the load order decides whether a module finds its
// imports initialised -- a `const` read before its module ran throws. Type-only imports are erased
// and do not count.
const sources = import.meta.glob(['/src/**/*.{ts,vue}', '!/src/test/**', '!/src/playground/**', '!/src/**/*.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

const onlyTypes = (statement: string) => {
  if (/^\s*(?:import|export)\s+[\w$]+\s*,/.test(statement)) return false
  const names = /\{([^}]*)\}/.exec(statement)?.[1]
  if (names === undefined) return false
  const list = names
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return list.length > 0 && list.every((name) => name.startsWith('type '))
}

const normalize = (file: string) => {
  const parts: string[] = []
  for (const part of file.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  return parts.join('/')
}

const resolve = (from: string, specifier: string) => {
  let base: string
  if (specifier.startsWith('@/')) base = `/src/${specifier.slice(2)}`
  else if (specifier.startsWith('.')) base = normalize(`${from.slice(0, from.lastIndexOf('/'))}/${specifier}`)
  else return undefined
  return [base, `${base}.ts`, `${base}.vue`, `${base}/index.ts`].find((candidate) => candidate in sources)
}

const graph = new Map<string, string[]>()
for (const [file, raw] of Object.entries(sources)) {
  const code = file.endsWith('.vue')
    ? [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n')
    : raw
  const deps: string[] = []
  for (const match of code.matchAll(IMPORT)) {
    if (onlyTypes(match[0])) continue
    const target = resolve(file, match[1]!)
    if (target !== undefined) deps.push(target)
  }
  graph.set(file, deps)
}

// Tarjan's strongly connected components; a component of more than one module is a cycle.
const cycles = () => {
  let counter = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const found: string[][] = []
  const visit = (node: string) => {
    index.set(node, counter)
    low.set(node, counter)
    counter++
    stack.push(node)
    onStack.add(node)
    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(node, Math.min(low.get(node)!, low.get(next)!))
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!))
      }
    }
    if (low.get(node) !== index.get(node)) return
    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    if (component.length > 1) found.push(component.sort())
  }
  for (const node of graph.keys()) if (!index.has(node)) visit(node)
  return found
}

describe('import cycles', () => {
  it('reads the sources', () => {
    expect(graph.size).toBeGreaterThan(400)
  })

  it('leaves only the upload queue cycle, which the shared upload core removes', () => {
    expect(cycles()).toEqual([
      [
        '/src/components/damImage/uploadQueue/api/uploadApi.ts',
        '/src/components/damImage/uploadQueue/composables/uploadQueuesStore.ts',
        '/src/components/damImage/uploadQueue/composables/uploadService.ts',
      ],
    ])
  })
})
