import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { globalComponentNames } from './globalComponentNames.mjs'
import { recommended } from './plugin.mjs'

// The target `import` resolves to in an `exports` entry: the first key, in the object's own order, that
// is one of the conditions an import in node matches. `require.resolve` would take the `require` branch,
// the CommonJS build, a different module from the one the admin's own `import` gets.
const IMPORT_CONDITIONS = new Set(['import', 'node', 'module-sync', 'default'])
const importTarget = (entry) => {
  if (typeof entry === 'string') return entry
  if (Array.isArray(entry)) return entry.map(importTarget).find(Boolean)
  if (!entry || typeof entry !== 'object') return undefined
  if (Object.keys(entry).some((key) => key.startsWith('.'))) return importTarget(entry['.'])
  for (const [condition, target] of Object.entries(entry)) {
    if (IMPORT_CONDITIONS.has(condition)) {
      const resolved = importTarget(target)
      if (resolved) return resolved
    }
  }
  return undefined
}

// Resolved from the admin, not from this file: the admin declares these plugins, and under pnpm the
// library's own directory cannot see its consumer's packages. The package's directory is looked up
// rather than its entry resolved, so a package that only has an `import` entry is found as well.
const packageDir = (require, name) => {
  for (const base of require.resolve.paths(name) ?? []) {
    const dir = path.join(base, name)
    if (fs.existsSync(path.join(dir, 'package.json'))) return fs.realpathSync(dir)
  }
  return undefined
}

const loader = (root) => {
  const require = createRequire(root)
  return (name) => {
    const dir = packageDir(require, name)
    const exports = dir ? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')).exports : undefined
    const target = exports === undefined ? undefined : importTarget(exports)
    return import(pathToFileURL(target ? path.join(dir, target) : require.resolve(name)).href)
  }
}

// The component names in the admin's installed Vuetify, for `vue/no-undef-components`: registered by
// vite-plugin-vuetify, never imported, so the rule cannot see them otherwise.
const vuetifyComponents = (root) => {
  try {
    const content = fs.readFileSync(new URL('./node_modules/vuetify/dist/vuetify.d.ts', root), 'utf-8')
    const match = content.match(/interface GlobalComponents \{([\s\S]*?)\}/)
    return match?.[1] ? Array.from(match[1].matchAll(/^\s+([V][a-zA-Z0-9]+):/gm), (m) => m[1]) : []
  } catch (e) {
    console.error('Error reading vuetify.d.ts', e)
    return []
  }
}

const routeNameSeverity = (value) => (value === false || value === 'off' ? 'off' : value === 'warn' ? 'warn' : 'error')

/**
 * The whole eslint config of an admin, which each of them used to carry as a copy.
 *
 * `root` is the admin's `import.meta.url` (of its eslint.config.mjs): the plugins, Vuetify's component
 * list, `.oxlintrc.json` and `src/typed-router.d.ts` are all resolved against it, never against the
 * cwd -- an eslint run started from a subdirectory would otherwise lose the oxlint-disabled rules and
 * check route names against nothing. `extra` configs come last.
 *
 * @param {import('./plugin.d.mts').AnzuAdminEslintOptions} options
 * @param {...import('eslint').Linter.Config} extra
 */
export async function defineAnzuAdminConfig(options, ...extra) {
  const {
    root,
    oxlintConfig = '.oxlintrc.json',
    typedRouter = 'src/typed-router.d.ts',
    globalComponents = [],
    ignores = [],
    noExplicitAny = 'error',
    anzu = {},
    vueProject = {},
  } = options
  // A plain path is read as the path of the config file, like `import.meta.url` is.
  const rootUrl = String(root).startsWith('file:') ? String(root) : pathToFileURL(String(root)).href
  const load = loader(rootUrl)
  const { configureVueProject, defineConfigWithVueTs, vueTsConfigs } = await load('@vue/eslint-config-typescript')
  // Its `.vue` scan for type-aware rules starts at the admin's root rather than the cwd.
  configureVueProject({ rootDir: fileURLToPath(new URL('.', rootUrl)), ...vueProject })
  const plugin = async (name) => {
    const module = await load(name)
    return module.default ?? module
  }
  const pluginVue = await plugin('eslint-plugin-vue')
  const pluginPinia = await plugin('eslint-plugin-pinia')
  const vuetify = await plugin('eslint-plugin-vuetify')
  const oxlint = oxlintConfig ? await plugin('eslint-plugin-oxlint') : null

  return defineConfigWithVueTs(
    {
      name: 'app/files-to-lint',
      files: ['**/*.{ts,mts,tsx,vue}'],
    },
    {
      name: 'app/files-to-ignore',
      ignores: [
        '**/dist/**',
        '**/dist-ssr/**',
        '**/coverage/**',
        '.stylelintrc.js',
        '**/e2e/**',
        'src/typed-router.d.ts',
        ...ignores,
      ],
    },
    pluginVue.configs['flat/essential'],
    pluginVue.configs['flat/strongly-recommended'],
    pluginVue.configs['flat/recommended'],
    vueTsConfigs.recommended,
    {
      name: 'app/pinia',
      plugins: {
        pinia: pluginPinia,
      },
      rules: {
        'pinia/never-export-initialized-store': 'error',
        'pinia/no-duplicate-store-ids': 'error',
        'pinia/no-return-global-properties': 'error',
        'pinia/no-store-to-refs-in-store': 'error',
        'pinia/prefer-single-store-per-file': 'error',
        'pinia/prefer-use-store-naming-convention': 'error',
        'pinia/require-setup-store-properties-export': 'error',
      },
    },
    recommended(anzu),
    {
      name: 'app/rules',
      settings: {
        anzu: { typedRouter: fileURLToPath(new URL(typedRouter, rootUrl)) },
      },
      rules: {
        'anzu/valid-route-name': routeNameSeverity(anzu.validRouteName),
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-explicit-any': noExplicitAny,
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            caughtErrors: 'none',
          },
        ],
        'vue/multi-word-component-names': [
          'error',
          {
            ignores: ['Acl'],
          },
        ],
        'vue/valid-v-slot': ['error', { allowModifiers: true }],
        'vue/no-undef-components': [
          'error',
          {
            // Registered globally rather than imported, so the rule cannot see them: the Vuetify
            // components, common-admin's button aliases and `Acl`, the router's, and the admin's own.
            ignorePatterns: [
              ...vuetifyComponents(rootUrl),
              ...globalComponentNames,
              'RouterLink',
              'RouterView',
              ...globalComponents,
            ],
          },
        ],
        'vue/attribute-hyphenation': ['error', 'always'],
        'vue/v-on-event-hyphenation': ['error', 'always'],
        'vue/custom-event-name-casing': ['error', 'camelCase'],
        'vue/define-emits-declaration': ['error', 'type-based'],
        'vue/no-template-target-blank': ['error'],
        'vue/block-order': ['error', { order: [['script', 'template'], 'style'] }],
        'vue/define-macros-order': ['error'],
        'vue/component-name-in-template-casing': ['error'],
        'vue/component-api-style': ['error'],
        'vue/prefer-define-options': ['error'],
        'vue/no-setup-props-reactivity-loss': ['error'],
        'vue/no-ref-object-reactivity-loss': ['error'],
      },
    },
    {
      name: 'app/no-relative-imports',
      files: ['src/**/*.{ts,vue}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../*', './*'],
                message: 'Use absolute imports with @ instead of relative imports',
              },
            ],
          },
        ],
      },
    },
    {
      // File-based routing names these files, not us: `index.vue`, `new.vue`, `edit.vue`.
      name: 'app/file-based-routing',
      files: ['src/pages/**/*.vue'],
      rules: {
        'vue/multi-word-component-names': 'off',
      },
    },
    {
      name: 'app/test-files',
      files: ['**/*.test.{ts,js}', '**/*.spec.{ts,js}', '**/test/**/*.{ts,js}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'vue/one-component-per-file': 'off',
      },
    },
    ...vuetify.configs['flat/recommended-v4'],
    // Derives the disabled-rule list from the oxlint config, so a rule enabled there stops being run
    // twice. prefer-const is switched off in the shared oxlint rules on purpose, so that it stays
    // eslint's: oxlint does not run it inside a .vue at all.
    ...(oxlint ? await oxlint.buildFromOxlintConfigFile(fileURLToPath(new URL(oxlintConfig, rootUrl))) : []),
    {
      // The only eslint rules that fight oxfmt. Measured, not assumed: with this block removed, eslint
      // reports 85 warnings in an admin and 145 in common-admin, and in both they fall on these same
      // rules and no others.
      //
      // html-self-closing is configured rather than switched off, because only its `void` half
      // conflicts: oxfmt writes `<img />` where the rule's default demands `<img>`. With
      // `void: 'any'` the formatter keeps that half and eslint keeps `<VBtn></VBtn>`.
      name: 'app/owned-by-oxfmt',
      rules: {
        'vue/html-closing-bracket-newline': 'off',
        'vue/html-indent': 'off',
        'vue/singleline-html-element-content-newline': 'off',
        'vue/html-self-closing': [
          'error',
          {
            html: { void: 'any', normal: 'always', component: 'always' },
            svg: 'always',
            math: 'always',
          },
        ],
      },
    },
    ...extra
  )
}
