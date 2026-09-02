import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import vuetify from 'eslint-plugin-vuetify'
import oxlintPlugin from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'
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
      '**/docs/**',
      '.playwright-cli/**',
    ],
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
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'vue/one-component-per-file': 'off',
    },
  },
  ...vuetify.configs['flat/recommended-v4'],
  // Derives the disabled-rule list from .oxlintrc.json, so enabling a rule in
  // oxlint automatically stops eslint from running it.
  ...(await buildFromOxlintConfigFile('.oxlintrc.json')),
  // Turns off every eslint rule that would fight the formatter. oxfmt owns
  // formatting; leaving these on defeats eslint --cache, because autofixed
  // files are never written to the cache.
  skipFormatting,
)
