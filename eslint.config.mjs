import stylistic from '@stylistic/eslint-plugin'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import vuetify from 'eslint-plugin-vuetify'
import oxlint from 'eslint-plugin-oxlint'
import { recommended as anzuRecommended } from './src/eslint/plugin.mjs'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '.stylelintrc.cjs', '**/cypress/**', '**/docs/**'],
  },
  pluginVue.configs['flat/essential'],
  pluginVue.configs['flat/strongly-recommended'],
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  anzuRecommended({
    deprecatedImports: {
      mode: 'internal',
      skipFiles: [
        'src/lib.ts',
        'src/services/api/apiFetchByIds.ts',
        'src/components/form/AFormRemoteAutocompleteWithCached.vue',
        'src/components/filter/AFilterMixed.vue',
        'src/components/dam/assetSelect/composables/assetSelectListActions.ts',
      ],
    },
  }),
  {
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      'vue/multi-word-component-names': [
        'error',
        {
          ignores: ['Acl'],
        },
      ],
      'vue/valid-v-slot': ['error', { allowModifiers: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/comma-dangle': ['error', 'only-multiline'],
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          ignoreTrailingComments: true,
          ignoreUrls: true,
          ignoreRegExpLiterals: true,
          ignorePattern: '^import .*',
        },
      ],
      'vue/no-template-target-blank': ['error'],
      'vue/block-order': ['error', { order: [['script', 'template'], 'style'] }],
      'vue/define-macros-order': ['error'],
      'vue/component-name-in-template-casing': ['error'],
      'vue/component-api-style': ['error'],
      'vue/prefer-define-options': ['error'],
      'vue/require-typed-ref': ['error'],
      'vue/no-setup-props-reactivity-loss': ['error'],
      'vue/no-ref-object-reactivity-loss': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    name: 'app/test-files',
    files: ['**/*.test.{ts,js}', '**/*.spec.{ts,js}', '**/test/**/*.{ts,js}', '**/tests/**/*.{ts,js}'],
    rules: {
      // Relax rules for test files
      '@stylistic/max-len': ['error', { code: 150 }], // Longer lines for test descriptions
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow ! in tests
      'vue/one-component-per-file': 'off', // Allow multiple components in test files
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2 }], // More spacing in tests
      // Keep important rules
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
    },
  },
  ...vuetify.configs['flat/recommended-v4'],
  oxlint.configs['flat/recommended'],
)
