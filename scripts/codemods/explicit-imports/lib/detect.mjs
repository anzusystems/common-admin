import { compileSfc, contextNames, parseSfc } from './sfc.mjs'

/**
 * What unimport would inject into a file, run the way unplugin-auto-import runs it: after the
 * TypeScript is stripped (the plugin is a post transform), on the compiled script of a component,
 * and on its compiled render function through the template addon (`_ctx.X` of a known name).
 */
export function createDetector({ ts, sfc, unimport }, names) {
  const imports = [...names.values].map(([as, { imported, from }]) => ({ name: imported, as, from }))
  const context = unimport.createUnimport({ imports })

  const strip = (code, file) =>
    ts.transpileModule(code, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        verbatimModuleSyntax: true,
      },
    }).outputText

  async function detectScript(code, file) {
    const { matchedImports } = await context.detectImports(strip(code, file))
    return new Set(matchedImports.map((i) => i.as))
  }

  /** @returns {Promise<{ script: Set<string>, template: Set<string> }>} */
  async function detect(file, source) {
    if (!file.endsWith('.vue')) return { script: await detectScript(source, `${file}.ts`), template: new Set() }
    const descriptor = parseSfc(sfc, file, source)
    const { script, render, lang } = compileSfc(sfc, ts, file, descriptor)
    const template = new Set([...contextNames(render)].filter((name) => names.values.has(name)))
    return { script: script ? await detectScript(script, `${file}.${lang ? 'ts' : 'js'}`) : new Set(), template }
  }

  return { detect }
}
