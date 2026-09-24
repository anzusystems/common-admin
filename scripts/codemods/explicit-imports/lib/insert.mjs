/**
 * Adds import declarations to a script: named values into an existing value import of the same
 * module when there is one, types into an existing `import type` of it, anything else as a new
 * declaration after the last import (or at the top, below header comments and directives).
 */

const HEADER_COMMENT = /^(\/\/\/|\/\/\s*@|\/\*\s*(eslint|oxlint|@vitest)|\/\/\s*(eslint|oxlint)|\/\*\*?\s*@vitest)/

function declarationFor(names, from, typeOnly) {
  const sorted = [...names].sort((a, b) => a.local.localeCompare(b.local))
  const defaults = sorted.filter((n) => n.imported === 'default')
  const namespaces = sorted.filter((n) => n.imported === '*')
  const named = sorted.filter((n) => n.imported !== 'default' && n.imported !== '*')
  const lines = []
  const keyword = typeOnly ? 'import type' : 'import'
  const specifiers = named.map((n) => (n.imported === n.local ? n.local : `${n.imported} as ${n.local}`))
  for (const n of namespaces) lines.push(`${keyword} * as ${n.local} from '${from}'`)
  if (defaults.length) {
    const [first, ...rest] = defaults
    lines.push(`${keyword} ${first.local}${specifiers.length ? `, { ${specifiers.join(', ')} }` : ''} from '${from}'`)
    for (const n of rest) lines.push(`${keyword} ${n.local} from '${from}'`)
  } else if (specifiers.length) {
    lines.push(`${keyword} { ${specifiers.join(', ')} } from '${from}'`)
  }
  return lines
}

function topInsertionOffset(ts, code) {
  const comments = ts.getLeadingCommentRanges(code, 0) ?? []
  let offset = 0
  for (const comment of comments) {
    const text = code.slice(comment.pos, comment.end)
    const after = code.slice(comment.end, code.indexOf('\n', comment.end) + 1 || undefined)
    const blankLineFollows = /^[^\S\n]*\n[^\S\n]*\n/.test(code.slice(comment.end))
    if (!HEADER_COMMENT.test(text) && !blankLineFollows) break
    offset = comment.end + after.length
  }
  return offset
}

/**
 * @param additions {{ from: string, typeOnly: boolean, names: { imported: string, local: string }[] }[]}
 */
export function addImports(ts, code, additions, { js = false } = {}) {
  if (!additions.length) return code
  const sourceFile = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ESNext, true, js ? ts.ScriptKind.JS : ts.ScriptKind.TS)
  const imports = sourceFile.statements.filter(ts.isImportDeclaration)
  const edits = []
  const newLines = []

  for (const { from, typeOnly, names } of additions) {
    const named = names.filter((n) => n.imported !== 'default' && n.imported !== '*')
    const rest = names.filter((n) => !named.includes(n))
    const target = named.length
      ? imports.find((decl) => {
          const clause = decl.importClause
          return (
            decl.moduleSpecifier.text === from &&
            clause &&
            !!clause.isTypeOnly === typeOnly &&
            clause.namedBindings &&
            ts.isNamedImports(clause.namedBindings)
          )
        })
      : undefined
    if (target) {
      const bindings = target.importClause.namedBindings
      const specifiers = named.map((n) => (n.imported === n.local ? n.local : `${n.imported} as ${n.local}`))
      const last = bindings.elements.at(-1)
      if (last) {
        const comma = code.slice(last.end).match(/^\s*,/)
        const position = comma ? last.end + comma[0].length : last.end
        edits.push({ position, text: `${comma ? ' ' : ', '}${specifiers.join(', ')}${comma ? ',' : ''}` })
      } else {
        edits.push({ position: bindings.getStart() + 1, text: ` ${specifiers.join(', ')} ` })
      }
      newLines.push(...declarationFor(rest, from, typeOnly))
    } else {
      newLines.push(...declarationFor(names, from, typeOnly))
    }
  }

  if (newLines.length) {
    const block = newLines.join('\n') + '\n'
    if (!code.trim()) return `\n${block}`
    if (imports.length) {
      const lineEnd = code.indexOf('\n', imports.at(-1).end)
      edits.push({ position: lineEnd < 0 ? code.length : lineEnd, text: `\n${newLines.join('\n')}` })
    } else {
      const offset = topInsertionOffset(ts, code)
      const position = offset + (offset === 0 && code.startsWith('\n') ? 1 : 0)
      edits.push({ position, text: code.startsWith('\n', position) ? block : `${block}\n` })
    }
  }

  edits.sort((a, b) => b.position - a.position)
  let result = code
  for (const { position, text } of edits) result = result.slice(0, position) + text + result.slice(position)
  return result
}
