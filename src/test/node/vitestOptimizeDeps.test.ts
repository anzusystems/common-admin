import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'
import { compileTemplate, parse } from 'vue/compiler-sfc'

// The browser suite runs in Vite's dev server, and `vite-plugin-vuetify` imports a Vuetify component a template names
// from its own entry (`vuetify/components/VProgressLinear`). An entry `optimizeDeps.include` does not list is found
// only when a test file first loads it: Vite optimizes it then and reloads the page. With an empty cache, as on every
// CI run, the browser stopped loading test files after 130 of them ("iframe did not become ready"), 325 files unrun.

const ROOT = join(__dirname, '../../..')
const SRC = join(ROOT, 'src')

const vueFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? vueFiles(join(dir, entry.name)) : entry.name.endsWith('.vue') ? [join(dir, entry.name)] : []
  )

const included = (): Set<string> => {
  const config = readFileSync(join(ROOT, 'vitest.config.mts'), 'utf8')
  const list = /optimizeDeps:\s*\{\s*include:\s*\[([\s\S]*?)\]/.exec(config)?.[1] ?? ''
  return new Set([...list.matchAll(/'([^']+)'/g)].map(([, name]) => name!))
}

const importMap = JSON.parse(readFileSync(join(ROOT, 'node_modules/vuetify/dist/json/importMap.json'), 'utf8'))
  .components as Record<string, { from: string }>

const pascal = (name: string) => name.replace(/(?:^|-)(\w)/g, (_, c: string) => c.toUpperCase())

describe('optimizeDeps of the browser suite', () => {
  it('lists the entry of every Vuetify component a template of the library names', () => {
    const listed = included()
    expect(listed.has('vuetify/components/VBtn')).toBe(true)
    const missing: Record<string, string> = {}
    for (const file of vueFiles(SRC)) {
      const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
      if (!descriptor.template) continue
      const { code } = compileTemplate({ source: descriptor.template.content, filename: file, id: file })
      for (const [, name] of code.matchAll(/resolveComponent\("([^"]+)"/g)) {
        const component = importMap[pascal(name!)]
        const entry = component && `vuetify/${component.from}`
        if (entry && !listed.has(entry)) missing[entry] ??= relative(SRC, file)
      }
    }
    expect(missing).toEqual({})
  })
})
