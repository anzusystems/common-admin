/**
 * The auto-imported names, read from a freshly generated `src/auto-imports.d.ts`: values from the
 * `const X: typeof import('m').Y` declarations, types from the `export type { … } from 'm'` lines.
 * Modules of `dirs` are relative to `src/` there and become `@/…` imports.
 */
export const VUE_MACROS = new Set([
  'defineProps',
  'defineEmits',
  'defineExpose',
  'defineOptions',
  'defineSlots',
  'defineModel',
  'withDefaults',
])

function specifier(from) {
  if (from.startsWith('./')) return `@/${from.slice(2)}`
  if (from.startsWith('../')) throw new Error(`auto-import from outside src: ${from}`)
  return from
}

export function readAutoImports(dts) {
  const cut = dts.indexOf('// for vue template auto import')
  const text = cut >= 0 ? dts.slice(0, cut) : dts
  const values = new Map()
  const types = new Map()
  for (const m of text.matchAll(/^\s+const ([\w$]+): typeof import\('([^']+)'\)(?:\.([\w$]+)|\['([^']+)'\])?\s*$/gm)) {
    if (VUE_MACROS.has(m[1])) continue
    values.set(m[1], { imported: m[3] ?? m[4] ?? '*', from: specifier(m[2]) })
  }
  for (const m of text.matchAll(/^\s*export type \{ ([^}]+) \} from '([^']+)'/gm)) {
    for (const part of m[1].split(',')) {
      const [imported, local = imported] = part.trim().split(/\s+as\s+/)
      if (imported) types.set(local.trim(), { imported: imported.trim(), from: specifier(m[2]) })
    }
  }
  if (values.size === 0) throw new Error('no auto-imported values found in auto-imports.d.ts')
  return { values, types, all: new Set([...values.keys(), ...types.keys()]) }
}
