import { describe, expect, it } from 'vitest'
import { globKeyToSrcPath } from '@/testing/typedRouter'

export interface PackageJsonDependencies {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export interface DescribeDeclaredDependenciesOptions {
  /** The admin's sources: `import.meta.glob('/src/**\/*.{vue,ts,mts,scss}', { query: '?raw', import: 'default', eager: true })`. */
  sources: Record<string, string>
  /** The admin's `package.json`. */
  packageJson: PackageJsonDependencies
  /** Bare specifier prefixes that name no package: the admin's own aliases (`@/` is built in). */
  aliases?: string[]
}

// Module specifiers in code (static, `export … from`, side-effect and dynamic imports, `require`, the vitest
// module helpers, `typeof import()`) and in styles (`@use`, `@forward`, `@import`; group 1). A specifier has
// no whitespace and ends its statement or call, which leaves out prose such as `it('… from "now"')`.
const SPECIFIER_RE =
  /(?:(@(?:use|forward|import)\s+)|\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.(?:mock|doMock|importActual)\s*(?:<[^>]*>)?\(\s*)(['"])([^'"\s]+)\2(?=\s*(?:[;),]|$|with\s*[({]|assert\s*\{|as\s+[\w*-]+\s*;|show\b|hide\b))/gm

// A module augmentation (`declare module 'vue' {`) names a package too; a wildcard one (`'*.vue'`) names none.
const DECLARE_MODULE_RE = /\bdeclare\s+module\s+(['"])([^'"\s*]+)\1\s*\{/g

// Comments name modules in passing, so they go -- but only outside strings, template literals and regular
// expressions: `'image/*'` or `/['"]/` read as the start of a comment or a string would hide the code after it.
// A `/` starts a regular expression after an operator or a keyword. Taken for one where it divides (a member
// named like a keyword: `obj.in / 2`), the scan copies to the next `/` on that line and reads on from there.
const REGEX_AFTER_KEYWORD =
  /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|default|do|else|await|yield)$/
const REGEX_CAN_FOLLOW = new Set([
  '',
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
])
export const withoutComments = (source: string): string => {
  let out = ''
  let previous = ''
  let i = 0
  const copyQuoted = (quote: string) => {
    const start = i++
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') i++
      else if (quote !== '`' && source[i] === '\n') break
      i++
    }
    i++
    out += source.slice(start, i)
  }
  while (i < source.length) {
    const char = source[i]!
    const next = source[i + 1]
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
      out += ' '
    } else if (char === "'" || char === '"' || char === '`') {
      copyQuoted(char)
      previous = char
    } else if (char === '/' && (REGEX_CAN_FOLLOW.has(previous) || REGEX_AFTER_KEYWORD.test(out.trimEnd()))) {
      const start = i++
      let inClass = false
      while (i < source.length && source[i] !== '\n' && (inClass || source[i] !== '/')) {
        if (source[i] === '\\') i++
        else if (source[i] === '[') inClass = true
        else if (source[i] === ']') inClass = false
        i++
      }
      i++
      out += source.slice(start, i)
      previous = '/'
    } else {
      out += char
      if (!/\s/.test(char)) previous = char
      i++
    }
  }
  return out
}

// A `.vue` file imports in its `<script>` and `<style>` blocks; the template's text is prose.
const codeOf = (key: string, source: string): string =>
  key.endsWith('.vue')
    ? [...source.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)]
        .map((block) => withoutComments(block[2]!))
        .join('\n')
    : withoutComments(source)

// Sass resolves `@use 'utils/forms'` against the file's own directory first: a partial there is no package.
const isStylePartial = (key: string, specifier: string, keys: Set<string>): boolean => {
  const dir = key.slice(0, key.lastIndexOf('/'))
  const at = specifier.lastIndexOf('/')
  const [sub, name] = at === -1 ? ['', specifier] : [`/${specifier.slice(0, at)}`, specifier.slice(at + 1)]
  return ['.scss', '.css'].some(
    (ext) =>
      keys.has(`${dir}/${specifier}${ext}`) ||
      keys.has(`${dir}${sub}/_${name}${ext}`) ||
      keys.has(`${dir}/${specifier}/_index${ext}`) ||
      keys.has(`${dir}/${specifier}/index${ext}`)
  )
}

const NODE_BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'events',
  'fs',
  'module',
  'os',
  'path',
  'process',
  'stream',
  'url',
  'util',
  'worker_threads',
  'zlib',
])

/** The package a bare specifier imports from, or `null` for a relative path, an alias or a `scheme:` module. */
export const packageOfSpecifier = (specifier: string, aliases: string[] = []): string | null => {
  const path = specifier.split('?')[0]!
  if (/^(?:\.|\/|@\/|#|[a-z][a-z0-9+.-]*:)/.test(path)) return null
  if (aliases.some((alias) => path.startsWith(alias))) return null
  const parts = path.split('/')
  const name = path.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
  return NODE_BUILTINS.has(name) ? null : name
}

/** `file: specifier` for every import of a package the `package.json` does not declare. */
export function undeclaredImports(
  sources: Record<string, string>,
  packageJson: PackageJsonDependencies,
  aliases: string[] = []
): string[] {
  const declared = new Set(
    [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.peerDependencies,
      packageJson.optionalDependencies,
    ]
      .flatMap((deps) => Object.keys(deps ?? {}))
      // `@types/x` declares the types of `x`, `@types/scope__x` those of `@scope/x`.
      .flatMap((name) => (name.startsWith('@types/') ? [name, name.slice(7).replace(/^(.+)__/, '@$1/')] : [name]))
  )
  const keys = new Set(Object.keys(sources))
  const found: string[] = []
  for (const [key, source] of Object.entries(sources)) {
    const code = codeOf(key, source)
    for (const match of code.matchAll(SPECIFIER_RE)) {
      const specifier = match[3]!
      const name = packageOfSpecifier(specifier, aliases)
      if (name === null || declared.has(name)) continue
      if (match[1] && isStylePartial(key, specifier, keys)) continue
      found.push(`${globKeyToSrcPath(key)}: ${specifier}`)
    }
    for (const match of code.matchAll(DECLARE_MODULE_RE)) {
      const name = packageOfSpecifier(match[2]!, aliases)
      if (name !== null && !declared.has(name)) found.push(`${globKeyToSrcPath(key)}: ${match[2]}`)
    }
  }
  return [...new Set(found)].sort()
}

/**
 * A package the admin imports but does not declare works as long as another dependency brings it and the
 * package manager hoists it to the top of `node_modules` (yarn's `node-modules` linker does). Its version
 * is then whatever that dependency asks for, and a strict layout -- pnpm, or yarn's own PnP -- does not
 * hoist: the build stops at the first such import.
 */
export function describeDeclaredDependencies({
  sources,
  packageJson,
  aliases = [],
}: DescribeDeclaredDependenciesOptions): void {
  describe('declared dependencies', () => {
    it('reads the sources it is meant to check', () => {
      // A guard on the guard: an empty glob would leave nothing to check and pass.
      expect(Object.keys(sources).length).toBeGreaterThan(20)
    })

    it('imports only packages its package.json declares', () => {
      expect(undeclaredImports(sources, packageJson, aliases)).toEqual([])
    })
  })
}
