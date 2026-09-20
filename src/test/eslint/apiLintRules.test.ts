import { describe, expect, it } from 'vitest'
import { Linter } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { anzuPlugin } from '@/eslint/plugin.mjs'

// The two rules that carry the migration. They are what tells a call site it has not been moved
// over, so a rule that does not look at a helper leaves every call of it unguarded -- which is how
// `useApiCommand` came to be missing from the url-parameter check while holding most of the fleet's
// `:id` templates.

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

    // Both halves of the mismatch, the way it reports them for every other helper.
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

  // Every helper that takes a `urlTemplate` has to be in the checked list, and a new one is exactly
  // where it gets forgotten: `useApiCommand` was missing when it was added, and this one is the
  // destination for ten fleet sites that pass `urlParams`.
  it('covers the items helper too', () => {
    const messages = lint(
      `useApiFetchItems<Item>({ client, system, entity, urlTemplate: '/article/:id/routes', urlParams: { articleId: 1 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(2)
  })

  // Substitution is path-only, so the rule has to look only at the path. A placeholder in the query
  // is a literal the caller wrote on purpose; reporting it fails CI on good code, and adding the key
  // to silence the rule changes nothing at runtime.
  it('ignores a placeholder in the query, where nothing is substituted', () => {
    const messages = lint(
      `useApiFetchItems<Item>({ client, system, entity, urlTemplate: '/article/:id/routes?locale=:locale', urlParams: { id: 1 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // Only whole segments are placeholders, because only whole segments are substituted. A rule that
  // matched `:id` inside `prefix-:id` would demand a key the runtime never fills in -- and adding it
  // would turn CI green while the request still went out with the colon in the url.
  it('does not take a colon inside a segment for a placeholder', () => {
    const messages = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/item/prefix-:id', urlParams: {} })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // And the key is whatever follows the colon, because that is what the runtime looks up: it takes
  // `part.substring(1)` with no opinion on its shape. A rule that insisted on an identifier missed
  // `:asset-id` entirely and then reported the caller's correct `urlParams` as matching nothing.
  it('accepts a placeholder whose name is not an identifier', () => {
    const messages = lint(
      `useApiRequest<Item>({ client, method: 'GET', system, entity, urlTemplate: '/item/:asset-id', urlParams: { 'asset-id': 7 } })`,
      'url-params-match-template'
    )

    expect(messages).toHaveLength(0)
  })

  // A bare `:` is a key of `''` to the runtime, so it is one to the rule as well. Nobody writes it
  // deliberately; reporting it is how the typo is seen instead of going out as a literal colon.
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
      `import { useApiRequest } from '@anzusystems/common-admin/labs'
       const { execute } = useApiRequest<void>({ client, method: 'DELETE', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(1)
  })

  it('leaves a request that reads something back alone', () => {
    const messages = lint(
      `import { useApiRequest } from '@anzusystems/common-admin/labs'
       const { execute } = useApiRequest<Item>({ client, method: 'GET', system, entity })`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(0)
  })

  // The four criteria the spec sets besides `void`, none of which the type constraint catches: with
  // no inference site `R` resolves to the constraint itself and compiles, so only the rule sees them.
  it.each([
    // On a GET: with `DELETE` the delete branch reports it and the missing-type-argument criterion
    // goes untested -- removing the check from the rule left this case passing.
    ['no type argument at all', `useApiRequest({ client, method: 'GET', system, entity })`],
    ['any', `useApiRequest<any>({ client, method: 'GET', system, entity })`],
    ['never', `useApiRequest<never>({ client, method: 'GET', system, entity })`],
    ['a lowercase delete', `useApiRequest<Item>({ client, method: 'delete', system, entity })`],
  ])('names %s', (_label, call) => {
    const messages = lint(
      `import { useApiRequest } from '@anzusystems/common-admin/labs'\n${call}`,
      'prefer-api-command'
    )

    expect(messages).toHaveLength(1)
  })

  // Resolved through the scope, not matched by name: an import under another name is still the
  // helper, and something else called `useApiRequest` is not.
  it('follows the helper when it is imported under another name', () => {
    const messages = lint(
      `import { useApiRequest as apiRequest } from '@anzusystems/common-admin/labs'
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
})

// The plugin is javascript and its types are written by hand, so nothing keeps them honest but this.
// The first version of the declaration said `DEFAULT_INTERNAL_DEPRECATED_IMPORTS` was a list of
// strings; it is a list of `{ path, imports }`, and a consumer would have been handed a false type.
describe('the hand-written types for the plugin', () => {
  it('describes the deprecated-import lists the way they actually are', async () => {
    const { DEFAULT_DEPRECATED_IMPORTS, DEFAULT_INTERNAL_DEPRECATED_IMPORTS } = await import('@/eslint/plugin.mjs')

    expect(DEFAULT_DEPRECATED_IMPORTS.every((entry: unknown) => typeof entry === 'string')).toBe(true)
    expect(
      DEFAULT_INTERNAL_DEPRECATED_IMPORTS.every(
        (entry: { path?: unknown; imports?: unknown }) =>
          typeof entry?.path === 'string' && Array.isArray(entry?.imports)
      )
    ).toBe(true)
  })
})

describe('anzu/prefer-api-fetch-items', () => {
  const IMPORT = "import { useApiRequest } from '@anzusystems/common-admin/labs'\n"
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
      "import { useApiRequest as apiRequest } from '@anzusystems/common-admin/labs'\n" +
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
      "import { useApiCommand, useApiFetchItems } from '@anzusystems/common-admin/labs'\n" +
        'useApiCommand<Item[]>({ client })\nuseApiFetchItems<Item>({ client })',
      'prefer-api-fetch-items'
    )

    expect(messages).toHaveLength(0)
  })
})
