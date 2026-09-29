/**
 * A single-file component seen the way the Vue plugin compiles it in dev: `compileScript` without
 * an inlined template gives the bindings and the script, `compileTemplate` with those bindings
 * gives a render function where every name the template does not bind is `_ctx.X` — the names
 * unimport's template addon supplied.
 */
export function compileFs(ts) {
  return { fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, realpath: ts.sys.realpath }
}

export function parseSfc(sfc, file, source) {
  // An empty `<script setup>` is dropped by default; the imports have to go into it, not into a second one.
  const { descriptor, errors } = sfc.parse(source, { filename: file, ignoreEmpty: false })
  if (errors.length) throw new Error(`${file}: ${errors[0].message ?? errors[0]}`)
  return descriptor
}

export function isTsBlock(block) {
  return block?.lang === 'ts' || block?.lang === 'tsx'
}

export function compileSfc(sfc, ts, file, descriptor, { isProd = false } = {}) {
  const lang = isTsBlock(descriptor.scriptSetup ?? descriptor.script)
  let bindings
  let script
  if (descriptor.script || descriptor.scriptSetup) {
    const compiled = sfc.compileScript(descriptor, {
      id: 'explicit-imports',
      isProd,
      inlineTemplate: isProd,
      fs: compileFs(ts),
    })
    bindings = compiled.bindings
    script = compiled.content
  }
  let render = null
  if (descriptor.template && !isProd) {
    const compiled = sfc.compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: 'explicit-imports',
      compilerOptions: {
        bindingMetadata: bindings,
        prefixIdentifiers: true,
        isTS: lang,
        expressionPlugins: lang ? ['typescript'] : [],
      },
    })
    if (compiled.errors.length) throw new Error(`${file}: ${compiled.errors[0].message ?? compiled.errors[0]}`)
    render = compiled.code
  }
  return { bindings: bindings ?? {}, script, render, lang }
}

const CONTEXT_REFERENCE = /\b_ctx\.([\w$]+)\b/g
const TARGET_REFERENCE = /(\$setup|\$props|\$data|\$options|_ctx)\.([\w$]+)\b/g

/** Names the template reaches through `_ctx`: unbound, i.e. auto-imported or global properties. */
export function contextNames(render) {
  return new Set(Array.from(render?.matchAll(CONTEXT_REFERENCE) ?? [], (m) => m[1]))
}

/** Per name, where the template takes it from: `$setup`, `$props`, `_ctx`, … */
export function templateTargets(render) {
  const targets = {}
  for (const m of render?.matchAll(TARGET_REFERENCE) ?? []) {
    ;(targets[m[2]] ??= new Set()).add(m[1])
  }
  return Object.fromEntries(Object.entries(targets).map(([name, set]) => [name, [...set].sort()]))
}

/** The runtime `props` option of the compiled component (dev or prod), or '' when there is none. */
export function runtimeProps(script) {
  const match = script?.match(/(?<![\w$])props: /)
  if (!match) return ''
  const start = match.index + match[0].length
  let depth = 0
  let quote = null
  for (let i = start; i < script.length; i++) {
    const char = script[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === "'" || char === '"' || char === '`') quote = char
    else if ('({['.includes(char)) depth++
    else if (')}]'.includes(char)) {
      if (depth === 0) return script.slice(start, i)
      depth--
    } else if (depth === 0 && (char === ',' || char === '\n')) return script.slice(start, i)
  }
  return script.slice(start)
}
