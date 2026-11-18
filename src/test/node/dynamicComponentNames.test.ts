import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import { globalComponentNames } from '@/eslint/globalComponentNames.mjs'

// A component named by a string, `<component :is="'VSlideYTransition'">`, is looked up at runtime among the
// globally registered ones. The library build imports the Vuetify components a template names as tags, not one
// in a string, and an admin registers only what it imports: there the name renders as an empty element of that
// name, the component never runs, and a production build warns nowhere. The browser suite cannot see it, its
// Vuetify registers every component.

const SRC = join(__dirname, '../..')

const vueFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? vueFiles(join(dir, entry.name)) : entry.name.endsWith('.vue') ? [join(dir, entry.name)] : []
  )

/** The arguments of each `resolveDynamicComponent(…)` call in the code, parentheses balanced. */
const dynamicComponentArguments = (code: string): string[] => {
  const found: string[] = []
  const call = /resolveDynamicComponent\(/g
  for (let match = call.exec(code); match; match = call.exec(code)) {
    let depth = 1
    let at = call.lastIndex
    while (depth > 0 && at < code.length) {
      if (code[at] === '(') depth++
      else if (code[at] === ')') depth--
      at++
    }
    found.push(code.slice(call.lastIndex, at - 1))
  }
  return found
}

// An element as the compiler knows it (Vue's lists of HTML, SVG and MathML tags): it creates one without looking
// for a component. A component's kebab-case name is looked up in PascalCase too.
const isElement = (name: string) =>
  !compileTemplate({ source: `<${name} />`, filename: 'element.vue', id: 'element' }).code.includes('resolveComponent')
const resolvesAtRuntime = (name: string) =>
  isElement(name) ||
  (globalComponentNames as readonly string[]).includes(name.replace(/(?:^|-)(\w)/g, (_, c: string) => c.toUpperCase()))

describe('dynamic components named by a string', () => {
  it('name only a native element or a globally registered component', () => {
    const unresolved = vueFiles(SRC).flatMap((file) => {
      const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
      if (!descriptor.template) return []
      const { code } = compileTemplate({ source: descriptor.template.content, filename: file, id: file })
      return dynamicComponentArguments(code)
        .flatMap((args) => [...args.matchAll(/(['"`])([A-Za-z][\w-]*)\1/g)].map(([, , name]) => name))
        .filter((name) => !resolvesAtRuntime(name))
        .map((name) => `${relative(SRC, file)}: ${name}`)
    })
    expect(unresolved).toEqual([])
  })

  it('reads the names a template gives', () => {
    const { code } = compileTemplate({
      source: `<component :is="open ? 'div' : 'VSlideYTransition'" /><component is="ABtnPrimary" />`,
      filename: 'probe.vue',
      id: 'probe',
    })
    expect(dynamicComponentArguments(code)).toEqual([`_ctx.open ? 'div' : 'VSlideYTransition'`, `"ABtnPrimary"`])
  })

  it('tells a registered name from one that is not', () => {
    expect(['div', 'svg', 'ABtnPrimary', 'a-btn-primary'].filter(resolvesAtRuntime)).toHaveLength(4)
    expect(['dvi', 'VSlideYTransition', 'v-slide-y-transition', 'AFilterWrapper'].filter(resolvesAtRuntime)).toEqual([])
  })
})
