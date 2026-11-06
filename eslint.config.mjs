import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import vuetify from 'eslint-plugin-vuetify'
import oxlintPlugin from 'eslint-plugin-oxlint'
import { recommended as anzuRecommended } from './src/eslint/plugin.mjs'

const { buildFromOxlintConfigFile } = oxlintPlugin

export default defineConfigWithVueTs(
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
      '.stylelintrc.cjs',
      '**/cypress/**',
      '.playwright-cli/**',
      'scripts/codemods/explicit-imports/test/fixtures/**',
      'scripts/codemods/explicit-imports/test/expected/**',
    ],
  },
  {
    // `@/lib` is the public entry. A library module that imports it creates
    // a cycle through the entry and pulls every export into its graph.
    // Per-module output then ships all of it to each consumer of that module. Import from the defining module instead.
    name: 'app/no-public-entry',
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@/lib', message: 'Import from the module that defines it, not from the public entry.' }],
          patterns: [
            {
              regex: '^(\\.\\.?/)+lib$',
              message: 'Import from the module that defines it, not from the public entry.',
            },
          ],
        },
      ],
    },
  },
  pluginVue.configs['flat/essential'],
  pluginVue.configs['flat/strongly-recommended'],
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  anzuRecommended(),
  {
    name: 'app/rules',
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
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
    name: 'app/test-files',
    files: [
      '**/*.test.{ts,js}',
      '**/*.spec.{ts,js}',
      '**/test/**/*.{ts,js}',
      '**/tests/**/*.{ts,js}',
      '**/__tests__/**/*.{ts,js}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'vue/one-component-per-file': 'off',
    },
  },
  {
    // Factories: each call makes one component, and the two of a teleport slot share its target.
    name: 'app/component-factories',
    files: [
      'src/domains/remoteAutocomplete/composables/createRemoteAutocomplete.ts',
      'src/domains/system/appShell/composables/teleportSlot.ts',
    ],
    rules: {
      'vue/one-component-per-file': 'off',
    },
  },
  ...vuetify.configs['flat/recommended-v4'],
  // Derives the disabled-rule list from .oxlintrc.json, so enabling a rule in
  // oxlint automatically stops eslint from running it.
  ...(await buildFromOxlintConfigFile('.oxlintrc.json')),
  {
    // The only eslint rules that conflict with oxfmt. Measured: without
    // this block eslint reports 145 warnings, all on these rules.
    // `html-self-closing` is configured, not disabled, because only its `void`
    // part conflicts: oxfmt writes `<img />` but the rule's default wants `<img>`.
    // With `void: 'any'` eslint still enforces `<VBtn></VBtn>`.
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
  }
)
