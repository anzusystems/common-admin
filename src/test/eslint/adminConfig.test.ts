import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ESLint, type Linter } from 'eslint'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defineAnzuAdminConfig, type AnzuAdminEslintOptions } from '@/eslint/plugin.mjs'

// The admins' eslint config, now the library's: an admin in a temp dir whose .oxlintrc.json extends
// the shared oxlint rules and whose typed router has two routes. Its node_modules is the library's,
// which has every plugin the config loads.

let dir: string
let root: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'anzu-admin-eslint-'))
  mkdirSync(join(dir, 'src/pages'), { recursive: true })
  symlinkSync(resolve('node_modules'), join(dir, 'node_modules'))
  writeFileSync(
    join(dir, 'src/typed-router.d.ts'),
    "export interface RouteNamedMap {\n  '/articles': RouteRecordInfo<'/articles'>\n  '/articles/[id]': RouteRecordInfo<'/articles/[id]'>\n}\n"
  )
  writeFileSync(
    join(dir, '.oxlintrc.json'),
    JSON.stringify({ extends: [resolve('src/eslint/oxlint-admin.json')], categories: { correctness: 'error' } })
  )
  root = pathToFileURL(join(dir, 'eslint.config.mjs')).href
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const eslintFor = async (options: Partial<AnzuAdminEslintOptions> = {}, ...extra: Linter.Config[]) =>
  new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: (await defineAnzuAdminConfig({ root, ...options }, ...extra)) as Linter.Config[],
  })

const lintMessages = async (code: string, file: string, options: Partial<AnzuAdminEslintOptions> = {}) => {
  const [result] = await (await eslintFor(options)).lintText(code, { filePath: join(dir, file) })
  return result!.messages
}

const lint = async (code: string, file: string, options: Partial<AnzuAdminEslintOptions> = {}) =>
  (await lintMessages(code, file, options)).map((m) => m.ruleId)

describe('defineAnzuAdminConfig', () => {
  it('checks route names against the typed router the root points to, in code and in templates', async () => {
    expect(await lint("export const to = { name: '/articles' }\n", 'src/a.ts')).toEqual([])
    expect(await lint("export const to = { name: '/nope' }\n", 'src/a.ts')).toEqual(['anzu/valid-route-name'])
    const view = `<script setup lang="ts">\n</script>\n\n<template>\n  <RouterLink :to="{ name: '/nope' }">\n    x\n  </RouterLink>\n</template>\n`
    expect(await lint(view, 'src/pages/index.vue')).toEqual(['anzu/valid-route-name'])
  })

  it('takes the route rule severity as the other anzu rules do', async () => {
    const bad = "export const to = { name: '/nope' }\n"
    expect(await lint(bad, 'src/a.ts', { anzu: { validRouteName: true } })).toEqual(['anzu/valid-route-name'])
    const [warning] = await lintMessages(bad, 'src/a.ts', { anzu: { validRouteName: 'warn' } })
    expect(warning?.severity).toBe(1)
    expect(await lint(bad, 'src/a.ts', { anzu: { validRouteName: false } })).toEqual([])
  })

  it('says once which typed router it could not read', async () => {
    const messages = await lintMessages('export const a = 1\n', 'src/a.ts', { typedRouter: 'src/missing-router.d.ts' })
    expect(messages.map((m) => m.ruleId)).toEqual(['anzu/valid-route-name'])
    expect(messages[0]!.message).toContain('missing-router.d.ts is missing or empty')
    expect(await lint('export const a = 1\n', 'src/b.ts', { typedRouter: 'src/missing-router.d.ts' })).toEqual([])
  })

  // As an admin runs it: its eslint.config.mjs, started from a subdirectory. The files the preset reads
  // come from `root`; the rule's cwd fallback would look for `src/src/typed-router.d.ts`.
  it('reads everything from the root when eslint runs in a subdirectory', async () => {
    const config = join(dir, 'eslint.config.mjs')
    writeFileSync(
      config,
      `import { defineAnzuAdminConfig } from ${JSON.stringify(pathToFileURL(resolve('src/eslint/plugin.mjs')).href)}\n` +
        'export default defineAnzuAdminConfig({ root: import.meta.url })\n'
    )
    try {
      const eslint = new ESLint({ cwd: join(dir, 'src'), overrideConfigFile: config })
      const lintFile = async (code: string, file: string) =>
        (await eslint.lintText(code, { filePath: join(dir, file) }))[0]!.messages.map((m) => m.ruleId)

      expect(await lintFile("export const to = { name: '/articles' }\n", 'src/a.ts')).toEqual([])
      expect(await lintFile("export const to = { name: '/nope' }\n", 'src/a.ts')).toEqual(['anzu/valid-route-name'])
      const resolved = await eslint.calculateConfigForFile(join(dir, 'src/a.ts'))
      expect(resolved.rules['no-var']).toEqual([0])
    } finally {
      rmSync(config)
    }
  })

  it('takes the path of the config file for `root` too', async () => {
    const eslint = new ESLint({
      cwd: dir,
      overrideConfigFile: true,
      overrideConfig: (await defineAnzuAdminConfig({ root: join(dir, 'eslint.config.mjs') })) as Linter.Config[],
    })
    const [result] = await eslint.lintText("export const to = { name: '/nope' }\n", { filePath: join(dir, 'src/a.ts') })
    expect(result!.messages.map((m) => m.ruleId)).toEqual(['anzu/valid-route-name'])
  })

  it('leaves the rules the shared oxlint config enables to oxlint, following its `extends`', async () => {
    const config = await (await eslintFor()).calculateConfigForFile(join(dir, 'src/a.ts'))
    expect(config.rules['no-var']).toEqual([0])
    expect(config.rules['prefer-const']).not.toEqual([0])

    const withoutOxlint = await (await eslintFor({ oxlintConfig: false })).calculateConfigForFile(join(dir, 'src/a.ts'))
    expect(withoutOxlint.rules['no-var']).not.toEqual([0])
  })

  it('ignores what it is told to', async () => {
    const eslint = await eslintFor({ ignores: ['src/generated/**'] })
    expect(await eslint.isPathIgnored(join(dir, 'src/generated/a.ts'))).toBe(true)
    expect(await eslint.isPathIgnored(join(dir, 'src/a.ts'))).toBe(false)
  })

  // The admin's own `import` of a plugin has to get the module the preset loaded: eslint refuses a
  // second, different `pinia`, and a `configureVueProject()` call on another copy changes nothing.
  it('loads the plugins the admin imports, not other builds of them', async () => {
    const { default: pinia } = await import('eslint-plugin-pinia')
    const eslint = await eslintFor(
      {},
      { plugins: { pinia: pinia as ESLint.Plugin }, rules: { 'pinia/no-return-global-properties': 'warn' } }
    )
    const [result] = await eslint.lintText('export const a = 1\n', { filePath: join(dir, 'src/a.ts') })
    expect(result!.messages).toEqual([])

    const { configureVueProject } = await import('@vue/eslint-config-typescript')
    configureVueProject({ scriptLangs: ['ts', 'js'] })
    try {
      const config = await (await eslintFor()).calculateConfigForFile(join(dir, 'src/pages/index.vue'))
      expect(JSON.stringify(config.rules['vue/block-lang'])).toContain('"js"')
    } finally {
      configureVueProject({ scriptLangs: ['ts'] })
    }
  })

  it('passes the vue project settings on', async () => {
    const { configureVueProject } = await import('@vue/eslint-config-typescript')
    try {
      const eslint = await eslintFor({ vueProject: { scriptLangs: ['ts', 'js'] } })
      const config = await eslint.calculateConfigForFile(join(dir, 'src/pages/index.vue'))
      expect(JSON.stringify(config.rules['vue/block-lang'])).toContain('"js"')
    } finally {
      configureVueProject({ scriptLangs: ['ts'] })
    }
    const config = await (await eslintFor()).calculateConfigForFile(join(dir, 'src/pages/index.vue'))
    expect(JSON.stringify(config.rules['vue/block-lang'])).not.toContain('"js"')
  })

  it('takes the admin differences as options', async () => {
    const any = 'export const a: any = 1\n'
    expect(await lint(any, 'src/a.ts')).toEqual(['@typescript-eslint/no-explicit-any'])
    expect(await lint(any, 'src/a.ts', { noExplicitAny: 'off' })).toEqual([])

    const map = `<script setup lang="ts">\n</script>\n\n<template>\n  <GMapMap />\n</template>\n`
    expect(await lint(map, 'src/pages/index.vue')).toEqual(['vue/no-undef-components'])
    expect(await lint(map, 'src/pages/index.vue', { globalComponents: ['GMapMap'] })).toEqual([])
  })

  it('keeps application code on absolute imports', async () => {
    expect(await lint("import { x } from '../x'\n\nexport const y = x\n", 'src/a.ts')).toContain(
      'no-restricted-imports'
    )
  })
})
