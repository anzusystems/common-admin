import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Linter } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { anzuPlugin, recommended } from '@/eslint/plugin.mjs'

// The two rules that carry the migration. They tell a call site that it has not been moved over.
// A rule that ignores a helper leaves every call of it unguarded. That is how `useApiCommand`
// was missing from the url-parameter check while holding most of the `:id` templates.

const lint = (code: string, rule: string) => {
  const linter = new Linter()

  return linter.verify(
    code,
    [
      {
        // Both needed: without a `files` pattern that the filename below matches, flat config finds no
        // configuration and reports nothing, which reads exactly like a rule that found no problem.
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
        plugins: { anzu: anzuPlugin },
        rules: { [`anzu/${rule}`]: 'error' },
      },
    ],
    'file.ts'
  )
}

describe('anzu/url-params-match-template', () => {
  it('reports a command whose urlParams do not match its template', () => {
    const messages = lint(
      `useApiCommand({ client, method: 'DELETE', system, entity, urlTemplate: '/adm/v1/item/:id', urlParams: { itemId: 1 } })`,
      'url-params-match-template'
    )

    expect(messages.map((message) => message.message)).toStrictEqual([
      "urlParams is missing key 'id' required by urlTemplate '/adm/v1/item/:id'.",
      "urlParams key 'itemId' has no matching ':itemId' placeholder in urlTemplate '/adm/v1/item/:id'.",
    ])
  })

  it('leaves a command alone when they do match', () => {
    const messages = lint(
      `useApiCommand({ client, method: 'DELETE', system, entity, urlTemplate: '/adm/v1/item/:id', urlParams: { id: 1 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // Every helper that takes a `urlTemplate` must be in the checked list.
  // `useApiCommand` was missing when it was added.
  it('covers the items helper too', () => {
    const messages = lint(
      `useApiFetchItems<Item>({ client, system, entity, urlTemplate: '/article/:id/routes', urlParams: { articleId: 1 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(2)
  })

  // Substitution is path-only, so the rule looks only at the path.
  // A placeholder in the query is a literal the caller wrote on purpose.
  // Reporting it fails CI on good code, and adding a key changes nothing at runtime.
  it('ignores a placeholder in the query, where nothing is substituted', () => {
    const messages = lint(
      `useApiFetchItems<Item>({ client, system, entity, urlTemplate: '/article/:id/routes?locale=:locale', urlParams: { id: 1 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // Only whole segments are placeholders, because only whole segments are substituted.
  // A rule matching `:id` inside `prefix-:id` would demand a key the runtime never fills in.
  // Adding it would turn CI green while the request still goes out with the colon in the url.
  it('does not take a colon inside a segment for a placeholder', () => {
    const messages = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/item/prefix-:id', urlParams: {} })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // The key is whatever follows the colon, because the runtime takes `part.substring(1)` without checking its shape.
  // A rule that required an identifier missed `:asset-id` and reported the correct `urlParams` as matching nothing.
  it('accepts a placeholder whose name is not an identifier', () => {
    const messages = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/item/:asset-id', urlParams: { 'asset-id': 7 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // A bare `:` is a key of `''` to the runtime, so it is one to the rule too.
  // Reporting it exposes the typo instead of sending a literal colon.
  it('treats a bare colon the way the runtime does', () => {
    const missing = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/item/:', urlParams: {} })`,
      'url-params-match-template'
    )
    const supplied = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/item/:', urlParams: { '': 7 } })`,
      'url-params-match-template'
    )

    expect(missing).toHaveLength(1)
    expect(supplied).toHaveLength(0)
  })

  it('still reports the helper it always covered', () => {
    const messages = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/adm/v1/item/:id', urlParams: { itemId: 1 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(2)
  })
})

describe('anzu/prefer-api-command', () => {
  it('names a request that reads nothing back', () => {
    const messages = lint(
      `import { useApiRequest } from '@anzusystems/common-admin'
       const { execute } = useApiRequest<void>({ client, method: 'DELETE', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(1)
  })

  it('leaves a request that reads something back alone', () => {
    const messages = lint(
      `import { useApiRequest } from '@anzusystems/common-admin'
       const { execute } = useApiRequest<Item>({ client, method: 'GET', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(0)
  })

  // The four criteria besides `void` are not caught by the type constraint.
  // With no inference site `R` resolves to the constraint itself and compiles, so only the rule sees them.
  it.each([
    // Uses GET: with `DELETE` the delete branch reports first,
    // so the missing-type-argument check goes untested. Removing the check from the rule left this case passing.
    ['no type argument at all', `useApiRequest({ client, method: 'GET', system, entity })`],
    ['any', `useApiRequest<any>({ client, method: 'GET', system, entity })`],
    ['never', `useApiRequest<never>({ client, method: 'GET', system, entity })`],
    ['a lowercase delete', `useApiRequest<Item>({ client, method: 'delete', system, entity })`],
  ])('names %s', (_label, call) => {
    const messages = lint(`import { useApiRequest } from '@anzusystems/common-admin'\n${call}`, 'prefer-api-command')

    expect(messages).toHaveLength(1)
  })

  // Resolved through the scope, not matched by name: an import under another name is still the
  // helper, and something else called `useApiRequest` is not.
  it('follows the helper when it is imported under another name', () => {
    const messages = lint(
      `import { useApiRequest as apiRequest } from '@anzusystems/common-admin'
       const { execute } = apiRequest<void>({ client, method: 'DELETE', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(1)
  })

  it("leaves someone else's function of the same name alone", () => {
    const messages = lint(
      `import { useApiRequest } from './my-own-helpers'
       const { execute } = useApiRequest<void>({ client, method: 'DELETE', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(0)
  })

  // The library lints itself with these rules, and finds its own helper by path: a move of the file
  // would silence both rules on the library without a report.
  it("checks the library's own calls of the helper", () => {
    expect(existsSync(fileURLToPath(new URL('../../domains/api/composables/useApiRequest.ts', import.meta.url)))).toBe(
      true
    )
    const messages = lint(
      `import { useApiRequest } from '@/domains/api/composables/useApiRequest'
       const { execute } = useApiRequest<void>({ client, method: 'DELETE', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(1)
  })
})

// Every admin still calls `recommended({ deprecatedImports: 'error' })`. The rule is gone with the old
// variants it guarded, so the option has to be ignored rather than turn into a rule nobody defines.
describe('recommended()', () => {
  it('names only rules the plugin defines, whatever options it is given', () => {
    const { rules } = recommended({ deprecatedImports: 'error' })

    for (const name of Object.keys(rules)) {
      expect(anzuPlugin.rules).toHaveProperty(name.replace(/^anzu\//, ''))
    }
    expect(rules).not.toHaveProperty('anzu/no-deprecated-imports')
  })
})

describe('anzu/prefer-api-fetch-items', () => {
  const IMPORT = "import { useApiRequest } from '@anzusystems/common-admin'\n"
  const call = (generic: string) => `${IMPORT}useApiRequest<${generic}>({ client, system: 's', entity: 'e' })`

  it.each([
    ['a bare array', 'Item[]'],
    ['Array<>', 'Array<Item>, Body'],
    ['an array of primitives', 'string[], null'],
  ])('reports %s', (_label, generic) => {
    const messages = lint(call(generic), 'prefer-api-fetch-items')

    expect(messages).toHaveLength(1)
    expect(messages[0].message).toContain("shape: 'array'")
  })

  it.each([['ApiResponseList<Item[]>'], ['ApiInfiniteResponseList<Item[]>'], ['{ data: Item[] }, null']])(
    'reports the envelope %s',
    (generic) => {
      const messages = lint(call(generic), 'prefer-api-fetch-items')

      expect(messages).toHaveLength(1)
      expect(messages[0].message).toContain('list envelope')
    }
  )

  // A false report is worse than a missed site: it teaches people to reach for the disable comment.
  it.each([
    ['not a list at all', 'Item'],
    ['a literal with no data member', '{ count: number; hasMore: boolean }'],
    ['an array member that is not called data', '{ userAdminConfigs: IntegerId[] }'],
    ['a literal that declares it reads metadata', '{ data: Item[]; hasNextPage: boolean }'],
    ['an array in the BODY slot', 'Item, Body[]'],
    ['an envelope whose data is not a list', 'ApiResponseList<Item>'],
    ['an unknown generic wrapper', 'Wrapper<Item[]>'],
  ])('stays silent on %s', (_label, generic) => {
    expect(lint(call(generic), 'prefer-api-fetch-items')).toHaveLength(0)
  })

  it('follows the import alias rather than the name', () => {
    const messages = lint(
      "import { useApiRequest as apiRequest } from '@anzusystems/common-admin'\n" +
        "apiRequest<Item[]>({ client, system: 's', entity: 'e' })",
      'prefer-api-fetch-items'
    )

    expect(messages).toHaveLength(1)
  })

  it('leaves someone else `useApiRequest` alone', () => {
    const messages = lint(
      "import { useApiRequest } from './my-own-helpers'\nuseApiRequest<Item[]>({ client })",
      'prefer-api-fetch-items'
    )

    expect(messages).toHaveLength(0)
  })

  it('leaves the other helpers alone', () => {
    const messages = lint(
      "import { useApiCommand, useApiFetchItems } from '@anzusystems/common-admin'\n" +
        'useApiCommand<Item[]>({ client })\nuseApiFetchItems<Item>({ client })',
      'prefer-api-fetch-items'
    )

    expect(messages).toHaveLength(0)
  })
})
